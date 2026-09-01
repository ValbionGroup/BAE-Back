import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import Product from '#models/product'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import {
  eventRowsForSeason,
  kpisFor,
  predictionForSeason,
  seasonBounds,
  seasonLabel,
  seasonStartYear,
  type SeasonEventRow,
} from '#services/analytics_service'

const BURGER_CENTS = 400

let productSeq = 0

async function soiree(name: string, iso: string, status = 'completed') {
  return Event.create({
    name,
    description: null,
    date: DateTime.fromISO(iso),
    status,
    duration: 4 * 60 * 60,
  })
}

async function commande(
  eventId: number,
  quantity: number,
  unitPriceCents: number,
  status = 'completed'
) {
  productSeq += 1
  const burger = await Product.create({
    name: `Burger ${productSeq}`,
    isVegetarian: false,
    description: null,
    recipe: null,
  })
  const [row] = await db
    .table('orders')
    .insert({ event_id: eventId, status, created_at: new Date(), updated_at: new Date() })
    .returning('id')
  await db.table('order_products').insert({
    order_id: typeof row === 'object' ? Number(row.id) : Number(row),
    product_id: burger.id,
    quantity,
    unit_price_cents: unitPriceCents,
    list_price_cents: BURGER_CENTS,
  })
}

/**
 * La suite tourne sur la base de dev, semée. `predictionForSeason` interroge
 * **tout** l'historique — c'est le spec — donc une soirée semée fausserait la
 * moyenne. On vide le graphe des soirées ; la transaction globale le rend.
 */
async function videLesSoirees() {
  await db.from('order_products').delete()
  await db.from('pre_order_items').delete()
  await db.from('orders').delete()
  await db.from('pre_orders').delete()
  await db.from('event_products').delete()
  await db.from('event_jobs').delete()
  await db.from('member_responses').delete()
  await db.from('production_runs').delete()
  await db.from('member_event_assigned_jobs').delete()
  await db.from('sponsorship_categories').delete()
  await db.from('events').delete()
}

async function reponse(eventId: number, isAvailable: boolean) {
  const member = await MemberFactory.create()
  await db.table('member_responses').insert({
    member_id: member.id,
    event_id: eventId,
    is_available: isAvailable,
    created_at: new Date(),
    updated_at: new Date(),
  })
}

test.group('Analytics — bornes de saison', () => {
  test('le 1er août ouvre une saison, le 31 juillet ferme la précédente', ({ assert }) => {
    assert.equal(seasonStartYear(DateTime.fromISO('2025-08-01T00:00:00')), 2025)
    assert.equal(seasonStartYear(DateTime.fromISO('2026-07-31T23:59:59')), 2025)
    assert.equal(seasonStartYear(DateTime.fromISO('2026-08-01T00:00:00')), 2026)
  })

  test('les bornes encadrent la saison, fin exclusive', ({ assert }) => {
    const { from, to } = seasonBounds(2025)
    assert.equal(from.toISODate(), '2025-08-01')
    assert.equal(to.toISODate(), '2026-08-01')
  })

  test('le libellé nomme les deux années', ({ assert }) => {
    assert.equal(seasonLabel(2025), 'Saison 2025-2026')
  })
})

test.group('Analytics — agrégats par soirée', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => videLesSoirees())

  test("somme l'encaissé et compte les commandes non annulées", async ({ assert }) => {
    const event = await soiree('Rentrée', '2025-09-20T20:00:00')
    await commande(event.id, 2, 300)
    await commande(event.id, 1, 250)
    await commande(event.id, 5, 400, 'cancelled')

    const rows = await eventRowsForSeason(2025)

    assert.lengthOf(rows, 1)
    assert.equal(rows[0].orderCount, 2)
    assert.equal(rows[0].cashedCents, 2 * 300 + 250)
  })

  test("compte les présents sur les répondants, pas sur l'effectif", async ({ assert }) => {
    const event = await soiree('Halloween', '2025-10-31T20:00:00')
    await reponse(event.id, true)
    await reponse(event.id, true)
    await reponse(event.id, false)
    await MemberFactory.create()

    const rows = await eventRowsForSeason(2025)

    assert.equal(rows[0].presentCount, 2)
    assert.equal(rows[0].respondentCount, 3)
  })

  test('ne retient que les soirées de la saison demandée', async ({ assert }) => {
    await soiree('Fin de saison', '2025-07-31T20:00:00')
    await soiree('Début de saison', '2025-08-01T20:00:00')

    const rows = await eventRowsForSeason(2025)

    assert.deepEqual(
      rows.map((row) => row.name),
      ['Début de saison']
    )
  })

  test('marque à venir les soirées non achevées, et trie par date', async ({ assert }) => {
    await soiree('Deuxième', '2026-03-01T20:00:00', 'scheduled')
    await soiree('Première', '2026-02-01T20:00:00')

    const rows = await eventRowsForSeason(2025)

    assert.deepEqual(
      rows.map((row) => [row.name, row.upcoming]),
      [
        ['Première', false],
        ['Deuxième', true],
      ]
    )
  })
})

function row(over: Partial<SeasonEventRow> = {}): SeasonEventRow {
  return {
    id: 1,
    name: 'Soirée',
    date: '2025-09-20T20:00:00.000+00:00',
    orderCount: 100,
    cashedCents: 50000,
    presentCount: 10,
    respondentCount: 10,
    upcoming: false,
    ...over,
  }
}

test.group('Analytics — KPI de saison', () => {
  test('moyenne et écart-type de population sur les soirées achevées', ({ assert }) => {
    const kpis = kpisFor([row({ orderCount: 200 }), row({ orderCount: 300 })], null)

    assert.equal(kpis.avgOrdersPerEvent, 250)
    assert.equal(kpis.ordersStdDev, 50)
  })

  test('ignore les soirées à venir dans les moyennes', ({ assert }) => {
    const kpis = kpisFor([row({ orderCount: 200 }), row({ orderCount: 999, upcoming: true })], null)

    assert.equal(kpis.avgOrdersPerEvent, 200)
  })

  test('sans saison n-1, tous les deltas valent null', ({ assert }) => {
    const kpis = kpisFor([row()], null)

    assert.isNull(kpis.cashedDeltaPct)
    assert.isNull(kpis.avgBasketDeltaCents)
    assert.isNull(kpis.presenceDeltaPts)
  })

  test('compare à n-1 quand elle existe', ({ assert }) => {
    const kpis = kpisFor([row({ cashedCents: 12000 })], [row({ cashedCents: 10000 })])

    assert.equal(kpis.cashedDeltaPct, 20)
  })

  test('le taux de présence porte sur les répondants', ({ assert }) => {
    const kpis = kpisFor([row({ presentCount: 3, respondentCount: 4 })], null)

    assert.equal(kpis.presenceRate, 0.75)
  })

  test('une saison vide ne divise pas par zéro', ({ assert }) => {
    const kpis = kpisFor([], null)

    assert.equal(kpis.cashedCents, 0)
    assert.equal(kpis.avgOrdersPerEvent, 0)
    assert.equal(kpis.avgBasketCents, 0)
    assert.equal(kpis.presenceRate, 0)
  })
})

test.group('Analytics — prédiction', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => videLesSoirees())

  test('moyenne les soirées achevées et compte les précommandes en cours', async ({ assert }) => {
    const passee = await soiree('Passée A', '2025-09-20T20:00:00')
    const autre = await soiree('Passée B', '2025-10-20T20:00:00')
    await commande(passee.id, 1, 300)
    await commande(passee.id, 1, 300)
    await commande(autre.id, 1, 300)
    await commande(autre.id, 1, 300)
    await commande(autre.id, 1, 300)
    await commande(autre.id, 1, 300)

    const venir = await soiree('À venir', '2026-02-14T20:00:00', 'scheduled')
    const user = await MemberFactory.create()
    await db.table('pre_orders').insert([
      {
        event_id: venir.id,
        user_id: user.id,
        status: 'pending',
        discount_percent: 0,
        created_at: new Date(),
      },
      {
        event_id: venir.id,
        user_id: user.id,
        status: 'cancelled',
        discount_percent: 0,
        created_at: new Date(),
      },
    ])

    const prediction = await predictionForSeason(2025, 580)

    assert.isNotNull(prediction)
    assert.equal(prediction!.eventId, venir.id)
    assert.equal(prediction!.basedOnEventCount, 2)
    assert.equal(prediction!.expectedOrders, 3)
    assert.equal(prediction!.range, 1)
    assert.equal(prediction!.preOrderCount, 1)
    assert.equal(prediction!.estimatedRevenueCents, 3 * 580)
  })

  test('nulle quand aucune soirée ne reste à venir', async ({ assert }) => {
    await soiree('Passée', '2025-09-20T20:00:00')

    assert.isNull(await predictionForSeason(2025, 580))
  })

  test('nulle quand aucune soirée achevée ne sert de base', async ({ assert }) => {
    await soiree('À venir', '2026-02-14T20:00:00', 'scheduled')

    assert.isNull(await predictionForSeason(2025, 580))
  })

  test('nulle quand la prochaine soirée tombe hors de la saison demandée', async ({ assert }) => {
    const passee = await soiree('Passée', '2025-09-20T20:00:00')
    await commande(passee.id, 1, 300)
    await soiree('Saison suivante', '2026-09-20T20:00:00', 'scheduled')

    assert.isNull(await predictionForSeason(2025, 580))
  })
})

test.group('Analytics — route', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => videLesSoirees())

  test('rend la saison demandée, ses KPI et la liste des saisons', async ({ client, assert }) => {
    const event = await soiree('Rentrée', '2025-09-20T20:00:00')
    await commande(event.id, 2, 300)
    const user = await grantPermissions(await MemberFactory.create(), ['transaction:read'])

    const response = await client.get('/v1/analytics/season?season=2025').loginAs(user)

    response.assertStatus(200)
    const body = response.body() as {
      data: {
        season: { start_year: number; label: string }
        seasons: Array<{ start_year: number; event_count: number }>
        kpis: { cashed_cents: number; cashed_delta_pct: number | null }
        events: Array<{ name: string; order_count: number; cashed_cents: number }>
        prediction: unknown
      }
    }

    assert.equal(body.data.season.start_year, 2025)
    assert.equal(body.data.season.label, 'Saison 2025-2026')
    assert.deepEqual(
      body.data.seasons.map((s) => s.start_year),
      [2025]
    )
    assert.equal(body.data.kpis.cashed_cents, 600)
    assert.isNull(body.data.kpis.cashed_delta_pct)
    assert.lengthOf(body.data.events, 1)
    assert.equal(body.data.events[0].order_count, 1)
    assert.isNull(body.data.prediction)
  })

  test('sans season, retient la saison la plus récente qui porte une soirée', async ({
    client,
    assert,
  }) => {
    await soiree('Ancienne', '2024-09-20T20:00:00')
    await soiree('Récente', '2025-09-20T20:00:00')
    const user = await grantPermissions(await MemberFactory.create(), ['transaction:read'])

    const response = await client.get('/v1/analytics/season').loginAs(user)

    response.assertStatus(200)
    const body = response.body() as { data: { seasons: Array<{ start_year: number }> } }
    assert.deepEqual(
      body.data.seasons.map((s) => s.start_year),
      [2025, 2024]
    )
  })

  test('refuse un membre sans transaction:read', async ({ client }) => {
    const user = await grantPermissions(await MemberFactory.create(), [])

    const response = await client.get('/v1/analytics/season').loginAs(user)

    response.assertStatus(403)
  })
})
