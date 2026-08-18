import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import FastPass from '#models/fast_pass'
import PreOrder from '#models/pre_order'
import Product from '#models/product'
import { UserFactory } from '#database/factories/user_factory'
import JwtService from '#services/jwt_service'

async function makeEvent(capacity: number, startsIn: object = { days: 7 }): Promise<Event> {
  return Event.create({
    name: 'Soirée Hivernale',
    description: 'Hot-dogs, bières, crêpes',
    date: DateTime.now().plus(startsIn),
    status: 'scheduled',
    duration: 4,
    capacity,
  })
}

async function makePreOrder(eventId: number, status = 'pending'): Promise<PreOrder> {
  const user = await UserFactory.create()
  return PreOrder.create({ userId: user.id, eventId, status, transactionId: null, pickupAt: null })
}

/**
 * ⚠️ La suite tourne sur la base de **développement** : lire `data[0]` revient à
 * parier sur l'ordre de soirées qu'on n'a pas créées. On désigne toujours la
 * sienne par son identifiant.
 */
function rowFor(rows: EventRow[], id: number): EventRow {
  const row = rows.find((entry) => entry.id === id)
  if (row === undefined) throw new Error(`soirée ${id} absente du catalogue public`)
  return row
}

type EventRow = {
  id: number
  capacity: number
  placed: number
  remaining: number
  open: boolean
}

test.group('Catalogue public — soirées', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * L'endpoint qui justifie tout le groupe : la page d'accueil de la zone
   * commandes doit se lire **déconnecté**, sinon personne ne découvre ce que le
   * BAE propose avant de créer un compte.
   */
  test('se lit sans être authentifié', async ({ client }) => {
    await makeEvent(150)

    const response = await client.get('/v1/public/events')

    response.assertStatus(200)
  })

  /**
   * `capacity = 0` est le défaut de la migration, et il **ferme** la soirée.
   * Sans ce filtre, ajouter la colonne aurait publié d'un coup le menu de toutes
   * les soirées jamais créées.
   */
  test('ne publie que les soirées dont la capacité est ouverte', async ({ client, assert }) => {
    const open = await makeEvent(150)
    const closed = await makeEvent(0)

    const response = await client.get('/v1/public/events')
    const rows = response.body().data as EventRow[]
    const ids = rows.map((row) => row.id)

    // ⚠️ La suite tourne sur la base de développement : d'autres soirées
    // ouvertes peuvent préexister. On vérifie l'inclusion et l'exclusion, pas
    // l'égalité de la liste — sinon le test dépend du contenu de la base.
    assert.include(ids, open.id)
    assert.notInclude(ids, closed.id)
  })

  test('laisse ouverte une soirée encore à plus de 12 h', async ({ client, assert }) => {
    const later = await makeEvent(150, { hours: 24 })

    const response = await client.get('/v1/public/events')
    const row = rowFor(response.body().data as EventRow[], later.id)

    assert.isTrue(row.open)
  })

  test('décompte les précommandes déjà passées', async ({ client, assert }) => {
    const event = await makeEvent(3)
    await makePreOrder(event.id)
    await makePreOrder(event.id)

    const response = await client.get('/v1/public/events')
    const row = rowFor(response.body().data as EventRow[], event.id)

    assert.equal(row.placed, 2)
    assert.equal(row.remaining, 1)
    assert.isTrue(row.open)
  })

  /** Une précommande annulée a libéré sa place : la compter fermerait la soirée pour rien. */
  test('ne compte pas une précommande annulée', async ({ client, assert }) => {
    const event = await makeEvent(2)
    await makePreOrder(event.id, 'cancelled')

    const response = await client.get('/v1/public/events')
    const row = rowFor(response.body().data as EventRow[], event.id)

    assert.equal(row.placed, 0)
    assert.equal(row.remaining, 2)
  })

  test('ferme la soirée quand la capacité est atteinte', async ({ client, assert }) => {
    const event = await makeEvent(1)
    await makePreOrder(event.id)

    const response = await client.get('/v1/public/events')
    const row = rowFor(response.body().data as EventRow[], event.id)

    assert.equal(row.remaining, 0)
    assert.isFalse(row.open)
  })

  /**
   * La clôture précède le début de 12 h — le délai de production de la cuisine.
   * La soirée **reste affichée** : la retirer le jour même donnerait
   * l'impression qu'elle n'a jamais existé, juste au moment où le plus de monde
   * la cherche.
   */
  test('ferme les précommandes 12 h avant le début, sans masquer la soirée', async ({
    client,
    assert,
  }) => {
    const soon = await makeEvent(150, { hours: 6 })

    const response = await client.get('/v1/public/events')
    const rows = response.body().data as EventRow[]
    const row = rows.find((entry) => entry.id === soon.id)

    // Toujours publiée, mais fermée.
    assert.isDefined(row)
    assert.isFalse(row!.open)
  })
})

test.group('Catalogue public — menu', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function withMenu(capacity: number): Promise<Event> {
    const event = await makeEvent(capacity)
    const product = await Product.create({
      name: 'Hot-dog classique',
      description: 'Saucisse Strasbourg · oignons · moutarde',
      isVegetarian: false,
      recipe: null,
    })
    await event.related('products').attach({ [product.id]: { quantity: 40, price: 350 } })
    return event
  }

  /**
   * 404 et non un menu vide : publier la carte d'une soirée que personne n'a
   * ouverte à la précommande exposerait des prix qui ne sont pas encore arrêtés.
   */
  test('refuse le menu d’une soirée fermée', async ({ client }) => {
    const event = await withMenu(0)

    const response = await client.get(`/v1/public/events/${event.id}/menu`)

    response.assertStatus(404)
  })

  test('rend les prix en centimes, comme la colonne les stocke', async ({ client, assert }) => {
    const event = await withMenu(150)

    const response = await client.get(`/v1/public/events/${event.id}/menu`)
    const body = response.body().data as {
      lines: { productId: number; name: string; price: number }[]
    }

    response.assertStatus(200)
    assert.lengthOf(body.lines, 1)
    assert.equal(body.lines[0].price, 350)
  })

  /**
   * La remise vit côté serveur et voyage dans la réponse : le jour où le
   * paiement existera, c'est le serveur qui arrêtera le montant. Deux
   * définitions, une par côté, finiraient par diverger.
   */
  test('annonce la remise de précommande', async ({ client, assert }) => {
    const event = await withMenu(150)

    const response = await client.get(`/v1/public/events/${event.id}/menu`)
    const body = response.body().data as { discount_percent: number }

    // ⚠️ snake_case : `case_converter_middleware` convertit toute sortie.
    assert.equal(body.discount_percent, 10)
  })

  /**
   * Le délai voyage avec le menu pour que la page l'annonce sans le coder en
   * dur : il est réglable par `PRE_ORDER_CLOSE_LEAD_HOURS`, et une phrase figée
   * dans le gabarit mentirait au premier changement.
   */
  test('annonce le délai de clôture', async ({ client, assert }) => {
    const event = await withMenu(150)

    const response = await client.get(`/v1/public/events/${event.id}/menu`)
    const body = response.body().data as { close_lead_hours: number }

    assert.equal(body.close_lead_hours, 12)
  })
})

test.group('Catalogue public — formules', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * `fast_passes.price` est un décimal en **euros**, alors que
   * `event_products.price` est un entier en **centimes**. La conversion a lieu
   * dans le service pour que l'API n'expose qu'une seule unité monétaire.
   */
  test('convertit le tarif des formules en centimes', async ({ client, assert }) => {
    await FastPass.create({ label: '2 ans', description: null, duration: 730, price: 42 })

    const response = await client.get('/v1/public/fast-passes')
    const body = response.body().data as {
      plans: { label: string; price_cents: number }[]
    }

    response.assertStatus(200)
    const row = body.plans.find((entry) => entry.label === '2 ans')
    assert.equal(row?.price_cents, 4200)
  })

  /**
   * ⚠️ `fast_passes.duration` est un nombre d'**années**. La migration d'origine
   * l'annotait « in days », et `buyer_service` la lisait effectivement en jours :
   * une adhésion d'un an expirait le lendemain. Ce test épingle l'unité.
   */
  /**
   * La réduction adhérent voyage avec le catalogue plutôt que d'être écrite en
   * dur dans la page : c'est un argument commercial, et deux définitions du même
   * pourcentage finiraient par diverger.
   */
  test('annonce la réduction supplémentaire des adhérents', async ({ client, assert }) => {
    const response = await client.get('/v1/public/fast-passes')
    const body = response.body().data as { bonus_percent: number }

    assert.equal(body.bonus_percent, 5)
  })

  test('expose la durée en années, et non en jours', async ({ client, assert }) => {
    await FastPass.create({ label: '3 ans', description: null, duration: 3, price: 30 })

    const response = await client.get('/v1/public/fast-passes')
    const body = response.body().data as {
      plans: { label: string; duration_years: number }[]
    }

    const row = body.plans.find((entry) => entry.label === '3 ans')
    assert.equal(row?.duration_years, 3)
  })

  test('fait expirer une adhésion d’un an après un an, pas après un jour', async ({
    client,
    assert,
  }) => {
    const me = await UserFactory.create()
    const pass = await FastPass.create({
      label: '1 an',
      description: null,
      duration: 1,
      price: 12,
    })
    await db.table('subscriptions').insert({
      user_id: me.id,
      fast_pass_id: pass.id,
      subscribed_at: DateTime.now().minus({ days: 30 }).toSQL({ includeOffset: false }),
      transaction_id: null,
      created_at: DateTime.now().toSQL({ includeOffset: false }),
      updated_at: DateTime.now().toSQL({ includeOffset: false }),
    })

    const response = await client.get('/v1/account/subscriptions').loginAs(me)
    const rows = response.body().data as { status: string }[]

    assert.equal(rows[0].status, 'active')
  })
})

test.group('Mes achats', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('exige une authentification', async ({ client }) => {
    const response = await client.get('/v1/account/pre-orders')

    response.assertStatus(401)
  })

  test('ne rend que ses propres précommandes', async ({ client, assert }) => {
    const event = await makeEvent(150)
    const mine = await UserFactory.create()
    await PreOrder.create({ userId: mine.id, eventId: event.id, status: 'pending' })
    await makePreOrder(event.id)

    const response = await client.get('/v1/account/pre-orders').loginAs(mine)
    const rows = response.body().data as { id: number }[]

    response.assertStatus(200)
    assert.lengthOf(rows, 1)
  })

  /**
   * 404 et non 403 : distinguer les deux dirait à un curieux qu'une précommande
   * existe sous cet identifiant, ce qui est déjà une information.
   */
  test('rend 404, et non 403, sur la précommande d’un autre', async ({ client }) => {
    const event = await makeEvent(150)
    const other = await makePreOrder(event.id)
    const me = await UserFactory.create()

    const response = await client.get(`/v1/account/pre-orders/${other.id}`).loginAs(me)

    response.assertStatus(404)
  })

  test('calcule le total depuis le menu de la soirée', async ({ client, assert }) => {
    const event = await makeEvent(150)
    const product = await Product.create({
      name: 'Hot-dog classique',
      description: null,
      isVegetarian: false,
      recipe: null,
    })
    await event.related('products').attach({ [product.id]: { quantity: 40, price: 350 } })

    const me = await UserFactory.create()
    const preOrder = await PreOrder.create({
      userId: me.id,
      eventId: event.id,
      status: 'pending',
    })
    await db.table('pre_order_items').insert({
      pre_order_id: preOrder.id,
      product_id: product.id,
      quantity: 2,
      received_quantity: 0,
      created_at: DateTime.now().toSQL({ includeOffset: false }),
      updated_at: DateTime.now().toSQL({ includeOffset: false }),
    })

    const response = await client.get('/v1/account/pre-orders').loginAs(me)
    const rows = response.body().data as {
      total_cents: number
      paid: boolean
      reference: string
    }[]

    assert.equal(rows[0].total_cents, 700)
    // Aucun paiement n'est branché : la précommande ne peut pas se dire payée.
    assert.isFalse(rows[0].paid)
    assert.match(rows[0].reference, /^BAE-\d{4}-\d{4}$/)
  })

  /**
   * Le QR de retrait est le **seul** émetteur de jetons `pre_order` : le type
   * existait dans `QrTokenPayload` et `POST /v1/qr/verify` savait le lire, mais
   * rien ne le produisait. Ce test ferme la boucle émission → vérification.
   */
  test('émet un QR de retrait que le comptoir sait vérifier', async ({ client, assert }) => {
    const event = await makeEvent(150)
    const me = await UserFactory.create()
    const preOrder = await PreOrder.create({
      userId: me.id,
      eventId: event.id,
      status: 'pending',
    })

    const response = await client.get(`/v1/account/pre-orders/${preOrder.id}/qr`).loginAs(me)
    response.assertStatus(200)

    const body = response.body().data as { token: string; ttl_seconds: number }
    assert.equal(body.ttl_seconds, 180)

    const payload = await new JwtService().verifyQrToken(body.token)
    assert.equal(payload.type, 'pre_order')
    if (payload.type !== 'pre_order') throw new Error('type de jeton inattendu')
    assert.equal(payload.preOrderId, preOrder.id)
    assert.equal(payload.userId, me.id)
    assert.equal(payload.eventId, event.id)
  })

  /** Un jeton signé pour la précommande d'autrui n'a pas à exister. */
  test('refuse d’émettre le QR de la précommande d’un autre', async ({ client }) => {
    const event = await makeEvent(150)
    const other = await makePreOrder(event.id)
    const me = await UserFactory.create()

    const response = await client.get(`/v1/account/pre-orders/${other.id}/qr`).loginAs(me)

    response.assertStatus(404)
  })

  /**
   * Un QR pour une commande annulée se présenterait au stand et n'ouvrirait
   * rien : le refus doit tomber avant la file d'attente, avec un motif.
   */
  test('refuse le QR d’une précommande annulée', async ({ client }) => {
    const event = await makeEvent(150)
    const me = await UserFactory.create()
    const preOrder = await PreOrder.create({
      userId: me.id,
      eventId: event.id,
      status: 'cancelled',
    })

    const response = await client.get(`/v1/account/pre-orders/${preOrder.id}/qr`).loginAs(me)

    response.assertStatus(409)
  })

  test('rend ses cotisations avec leur échéance', async ({ client, assert }) => {
    const me = await UserFactory.create()
    const pass = await FastPass.create({
      label: '1 an',
      description: null,
      duration: 365,
      price: 25,
    })
    await db.table('subscriptions').insert({
      user_id: me.id,
      fast_pass_id: pass.id,
      subscribed_at: DateTime.now().toSQL({ includeOffset: false }),
      transaction_id: null,
      created_at: DateTime.now().toSQL({ includeOffset: false }),
      updated_at: DateTime.now().toSQL({ includeOffset: false }),
    })

    const response = await client.get('/v1/account/subscriptions').loginAs(me)
    const rows = response.body().data as { label: string; status: string; expires_at: string }[]

    response.assertStatus(200)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].label, '1 an')
    assert.equal(rows[0].status, 'active')
  })
})
