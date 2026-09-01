import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import Product from '#models/product'
import { MemberFactory } from '#database/factories/members_factory'
import {
  eventRowsForSeason,
  kpisFor,
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
