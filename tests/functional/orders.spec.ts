import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import Order from '#models/order'
import Product from '#models/product'
import Transaction from '#models/transaction'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

/**
 * `event_products.price` est un entier **en centimes** : 250 vaut 2,50 €.
 * `transactions.amount` est un `decimal(10,2)` **en euros**. Le passage de l'un
 * à l'autre est le piège central de ce domaine, et ces tests l'éprouvent.
 */
const HOTDOG_CENTS = 250
const BIERE_CENTS = 300

async function seedMenu() {
  const event = await Event.create({
    name: 'Soirée Hivernale',
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'ongoing',
    duration: 4 * 60 * 60,
  })

  const hotdog = await Product.create({
    name: 'Hot-dog classique',
    isVegetarian: false,
    description: null,
    recipe: null,
  })
  const biere = await Product.create({
    name: 'Bière pression 25cl',
    isVegetarian: true,
    description: null,
    recipe: null,
  })

  await event.related('products').attach({
    [hotdog.id]: { quantity: 200, price: HOTDOG_CENTS },
    [biere.id]: { quantity: 150, price: BIERE_CENTS },
  })

  return { event, hotdog, biere }
}

test.group('Orders — encaissement', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('enregistre la commande, ses lignes et la transaction en centimes', async ({
    client,
    assert,
  }) => {
    const { event, hotdog, biere } = await seedMenu()
    const cashier = await MemberFactory.create()
    const user = await grantPermissions(cashier, ['order:write', 'order:read'])

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({
        lines: [
          { product_id: hotdog.id, quantity: 2 },
          { product_id: biere.id, quantity: 1 },
        ],
      })
      .loginAs(user)

    response.assertStatus(201)

    const order = await Order.query().where('eventId', event.id).firstOrFail()
    assert.equal(order.memberId, cashier.id, 'le membre qui a pris la commande est tracé')
    assert.isNull(order.clientId, 'aucun acheteur désigné ici')
    assert.equal(order.status, 'pending')

    // 2 × 250 + 1 × 300 = 800 centimes = 8,00 €
    const transaction = await Transaction.findOrFail(order.transactionId!)
    assert.strictEqual(transaction.amount, 800)
    assert.equal(transaction.type, 'cash')

    const lines = await db.from('order_products').where('order_id', order.id).orderBy('product_id')
    assert.lengthOf(lines, 2)

    assert.equal(response.body().data.total_cents, 800)
    assert.equal(response.body().data.client_name, 'Anonyme')
  })

  test('fusionne deux lignes portant le même produit', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const user = await grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({
        lines: [
          { product_id: hotdog.id, quantity: 2 },
          { product_id: hotdog.id, quantity: 3 },
        ],
      })
      .loginAs(user)

    response.assertStatus(201)

    // `order_products` a une PK composite (order_id, product_id) : sans fusion
    // en amont, la seconde ligne violerait la contrainte.
    const order = await Order.query().where('eventId', event.id).firstOrFail()
    const lines = await db.from('order_products').where('order_id', order.id)
    assert.lengthOf(lines, 1)
    assert.equal(Number(lines[0].quantity), 5)
    assert.equal(response.body().data.total_cents, 5 * HOTDOG_CENTS)
  })

  test('refuse un produit absent du menu de la soirée', async ({ client, assert }) => {
    const { event } = await seedMenu()
    const horsMenu = await Product.create({
      name: 'Crêpe Nutella',
      isVegetarian: true,
      description: null,
      recipe: null,
    })
    const user = await grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: horsMenu.id, quantity: 1 }] })
      .loginAs(user)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_PRODUCT_NOT_ON_MENU')
    assert.include(response.body().error.message, 'Crêpe Nutella')
  })

  test('ignore un total envoyé par le client — il est recalculé côté serveur', async ({
    client,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    const user = await grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({
        lines: [{ product_id: hotdog.id, quantity: 2 }],
        // Un client malveillant annoncerait un centime. C'est de l'argent : le
        // serveur ne doit relire que `event_products.price`.
        total_cents: 1,
        amount: 0.01,
      })
      .loginAs(user)

    response.assertStatus(201)

    const order = await Order.query().where('eventId', event.id).firstOrFail()
    const transaction = await Transaction.findOrFail(order.transactionId!)
    assert.strictEqual(transaction.amount, 500)
    assert.equal(response.body().data.total_cents, 500)
  })

  test('rattache l’acheteur quand il est identifié', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const cashier = await MemberFactory.create()
    const buyer = await MemberFactory.with('user', 1, (u) =>
      u.merge({ firstName: 'Camille', lastName: 'Renard' })
    ).create()
    const user = await grantPermissions(cashier, ['order:write', 'order:read'])

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 1 }], client_id: buyer.id })
      .loginAs(user)

    response.assertStatus(201)
    assert.equal(response.body().data.client_name, 'Camille Renard')

    const order = await Order.query().where('eventId', event.id).firstOrFail()
    assert.equal(order.clientId, buyer.id)
    assert.notEqual(order.memberId, order.clientId)
  })

  test('refuse un panier vide', async ({ client }) => {
    const { event } = await seedMenu()
    const user = await grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [] })
      .loginAs(user)

    response.assertStatus(422)
  })

  test('refuse un membre sans order:write', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 1 }] })
      .loginAs(user)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_FORBIDDEN')
  })

  test('la numerotation repart a 1 sur chaque soiree', async ({ client, assert }) => {
    const first = await seedMenu()
    const second = await seedMenu()
    const user = await grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])

    // Deux commandes sur la premiere soiree.
    for (let i = 0; i < 2; i++) {
      await client
        .post(`/v1/events/${first.event.id}/orders`)
        .json({ lines: [{ product_id: first.hotdog.id, quantity: 1 }] })
        .loginAs(user)
    }

    // La premiere commande de la soiree suivante doit porter le numero 1, et non
    // 3 : le comptoir annonce « commande 1 » a chaque soiree, comme un fast-food.
    const response = await client
      .post(`/v1/events/${second.event.id}/orders`)
      .json({ lines: [{ product_id: second.hotdog.id, quantity: 1 }] })
      .loginAs(user)

    response.assertStatus(201)
    assert.equal(response.body().data.number, 1)
  })
})

test.group('Orders — lecture', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('numérote les commandes par soirée, dans l’ordre de création', async ({
    client,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    const user = await grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])

    for (let i = 0; i < 3; i++) {
      await client
        .post(`/v1/events/${event.id}/orders`)
        .json({ lines: [{ product_id: hotdog.id, quantity: 1 }] })
        .loginAs(user)
    }

    const response = await client.get(`/v1/events/${event.id}/orders`).loginAs(user)

    response.assertStatus(200)
    const orders = response.body().data
    assert.lengthOf(orders, 3)
    // Le numéro est dérivé (ROW_NUMBER par soirée), aucune colonne ne le porte.
    assert.deepEqual(orders.map((order: { number: number }) => order.number).sort(), [1, 2, 3])
  })

  test('refuse un membre sans order:read', async ({ client, assert }) => {
    const { event } = await seedMenu()
    const user = await grantPermissions(await MemberFactory.create(), [])

    const response = await client.get(`/v1/events/${event.id}/orders`).loginAs(user)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_FORBIDDEN')
  })
})

test.group('Orders — garde de stock', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function seller() {
    return grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])
  }

  async function produce(eventId: number, productId: number, quantity: number, memberId: number) {
    await db
      .table('production_runs')
      .insert({ event_id: eventId, product_id: productId, quantity, member_id: memberId })
  }

  /**
   * La garde front ne protège rien : un appel direct à l'API la contourne.
   */
  test('refuse de vendre au-delà de ce qui a été produit', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const user = await seller()
    await produce(event.id, hotdog.id, 10, user.id)

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 11 }] })
      .loginAs(user)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_INSUFFICIENT_STOCK')
    assert.include(response.body().error.message, '10')
    assert.lengthOf(await Order.query().where('eventId', event.id), 0)
  })

  test('laisse vendre exactement ce qui reste', async ({ client }) => {
    const { event, hotdog } = await seedMenu()
    const user = await seller()
    await produce(event.id, hotdog.id, 3, user.id)

    await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 3 }] })
      .loginAs(user)
      .then((r) => r.assertStatus(201))

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 1 }] })
      .loginAs(user)

    response.assertStatus(422)
  })

  /**
   * Sans cette tolérance, une soirée qui ne suit pas sa production ne pourrait
   * plus rien encaisser du tout.
   */
  test('laisse vendre quand aucune production n’est déclarée', async ({ client }) => {
    const { event, hotdog } = await seedMenu()
    const user = await seller()

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 50 }] })
      .loginAs(user)

    response.assertStatus(201)
  })

  test('ne compte pas les commandes annulées dans le vendu', async ({ client }) => {
    const { event, hotdog } = await seedMenu()
    const user = await grantPermissions(await MemberFactory.create(), [
      'order:write',
      'order:read',
      'order:delete',
    ])
    await produce(event.id, hotdog.id, 5, user.id)

    const first = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 5 }] })
      .loginAs(user)
    first.assertStatus(201)

    await client.delete(`/v1/orders/${first.body().data.id}`).loginAs(user)

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 5 }] })
      .loginAs(user)

    response.assertStatus(201)
  })

  test('nomme le produit en rupture', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const user = await seller()
    await produce(event.id, hotdog.id, 1, user.id)

    await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 1 }] })
      .loginAs(user)

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 1 }] })
      .loginAs(user)

    response.assertStatus(422)
    assert.include(response.body().error.message, 'Hot-dog classique')
    assert.include(response.body().error.message, 'rupture')
  })
})
