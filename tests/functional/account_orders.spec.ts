import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Product from '#models/product'
import Client from '#models/client'
import Order from '#models/order'
import { UserFactory } from '#database/factories/user_factory'
import { checkout } from '#services/order_service'

const HOTDOG_CENTS = 250

type MyOrder = {
  id: number
  number: number
  event_name: string
  status: string
  lines: { product_name: string; quantity: number; unit_price: number }[]
  total_cents: number
  saved_cents: number
}

async function seedEvent(name = 'Soirée Hivernale') {
  const event = await Event.create({
    name,
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

  await event.related('products').attach({ [hotdog.id]: { quantity: 200, price: HOTDOG_CENTS } })

  return { event, hotdog }
}

async function aClient() {
  const user = await UserFactory.create()
  await Client.create({ id: user.id, registeredAt: DateTime.now() })
  return user
}

test.group('Mes commandes au comptoir', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('liste les commandes passées à mon nom, avec leurs lignes', async ({ client, assert }) => {
    const user = await aClient()
    const { event, hotdog } = await seedEvent()
    await checkout(event.id, [{ productId: hotdog.id, quantity: 2 }], null, user.id)

    const response = await client.get('/v1/account/orders').loginAs(user)

    response.assertStatus(200)
    const orders = response.body().data as MyOrder[]
    assert.lengthOf(orders, 1)
    assert.equal(orders[0].event_name, 'Soirée Hivernale')
    assert.deepEqual(orders[0].lines, [
      { product_name: 'Hot-dog classique', quantity: 2, unit_price: HOTDOG_CENTS },
    ])
    assert.equal(orders[0].total_cents, 2 * HOTDOG_CENTS)
  })

  /**
   * Le cas majoritaire, et la raison pour laquelle la page doit s'en expliquer :
   * sans scan du QR, la commande n'est rattachée à personne.
   */
  test('une commande anonyme n’apparaît chez personne', async ({ client, assert }) => {
    const user = await aClient()
    const { event, hotdog } = await seedEvent()
    await checkout(event.id, [{ productId: hotdog.id, quantity: 1 }], null, null)

    const response = await client.get('/v1/account/orders').loginAs(user)

    assert.lengthOf(response.body().data as MyOrder[], 0)
  })

  test('la commande d’un autre client reste invisible', async ({ client, assert }) => {
    const mine = await aClient()
    const other = await aClient()
    const { event, hotdog } = await seedEvent()
    await checkout(event.id, [{ productId: hotdog.id, quantity: 1 }], null, other.id)

    const response = await client.get('/v1/account/orders').loginAs(mine)

    assert.lengthOf(response.body().data as MyOrder[], 0)
  })

  test('le numéro affiché est celui de la soirée, pas un rang personnel', async ({
    client,
    assert,
  }) => {
    const user = await aClient()
    const { event, hotdog } = await seedEvent()
    const line = [{ productId: hotdog.id, quantity: 1 }]
    await checkout(event.id, line, null, null)
    await checkout(event.id, line, null, user.id)
    await checkout(event.id, line, null, null)

    const response = await client.get('/v1/account/orders').loginAs(user)

    const orders = response.body().data as MyOrder[]
    assert.lengthOf(orders, 1)
    assert.equal(orders[0].number, 2)
  })

  test('deux soirées ont deux numérotations indépendantes', async ({ client, assert }) => {
    const user = await aClient()
    const first = await seedEvent('Soirée A')
    const second = await seedEvent('Soirée B')
    await checkout(first.event.id, [{ productId: first.hotdog.id, quantity: 1 }], null, user.id)
    await checkout(second.event.id, [{ productId: second.hotdog.id, quantity: 1 }], null, user.id)

    const response = await client.get('/v1/account/orders').loginAs(user)

    const orders = response.body().data as MyOrder[]
    assert.lengthOf(orders, 2)
    assert.deepEqual(
      orders.map((order) => order.number),
      [1, 1]
    )
  })

  /** `orders.event_id` est nullable : `numberOf` ne doit pas s'y casser. */
  test('une commande hors soirée ne fait pas planter la liste', async ({ client, assert }) => {
    const user = await aClient()
    await Order.create({ clientId: user.id, eventId: null, status: 'completed' })

    const response = await client.get('/v1/account/orders').loginAs(user)

    response.assertStatus(200)
    const orders = response.body().data as MyOrder[]
    assert.lengthOf(orders, 1)
    assert.equal(orders[0].event_name, 'Hors soirée')
  })

  test('une commande annulée reste listée', async ({ client, assert }) => {
    const user = await aClient()
    const { event, hotdog } = await seedEvent()
    const order = await checkout(event.id, [{ productId: hotdog.id, quantity: 1 }], null, user.id)
    const row = await Order.findOrFail(order.id)
    row.status = 'cancelled'
    await row.save()

    const response = await client.get('/v1/account/orders').loginAs(user)

    const orders = response.body().data as MyOrder[]
    assert.equal(orders[0].status, 'cancelled')
  })

  test('sans session, la route refuse', async ({ client }) => {
    const response = await client.get('/v1/account/orders')

    response.assertStatus(401)
  })
})
