import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import Order from '#models/order'
import Product from '#models/product'
import ProductionRun from '#models/production_run'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

async function seed() {
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

  await event.related('products').attach({ [hotdog.id]: { quantity: 200, price: 250 } })

  return { event, hotdog }
}

async function sell(eventId: number, productId: number, quantity: number, status = 'pending') {
  const order = await Order.create({ eventId, status })
  await db.table('order_products').insert({
    order_id: order.id,
    product_id: productId,
    quantity,
  })
  return order
}

test.group('Orders — restant vendable', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('déduit les ventes de ce qui a été produit', async ({ client, assert }) => {
    const { event, hotdog } = await seed()
    await ProductionRun.create({ eventId: event.id, productId: hotdog.id, quantity: 200 })
    await sell(event.id, hotdog.id, 30)

    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])
    const response = await client.get(`/v1/events/${event.id}/sellable`).loginAs(user)

    response.assertStatus(200)
    const [line] = response.body().data
    assert.equal(line.product_id, hotdog.id)
    assert.equal(line.planned_qty, 200)
    assert.equal(line.produced_qty, 200)
    assert.equal(line.sold_qty, 30)
    assert.equal(line.remaining_qty, 170)
  })

  test('une commande annulée ne compte pas comme vendue', async ({ client, assert }) => {
    const { event, hotdog } = await seed()
    await ProductionRun.create({ eventId: event.id, productId: hotdog.id, quantity: 100 })
    await sell(event.id, hotdog.id, 10)
    await sell(event.id, hotdog.id, 40, 'cancelled')

    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])
    const response = await client.get(`/v1/events/${event.id}/sellable`).loginAs(user)

    response.assertStatus(200)
    const [line] = response.body().data
    // Sans cette exclusion, tout le comptoir mentirait : une commande annulée
    // rendrait ses articles invendables.
    assert.equal(line.sold_qty, 10)
    assert.equal(line.remaining_qty, 90)
  })

  test('additionne plusieurs lancements de production', async ({ client, assert }) => {
    const { event, hotdog } = await seed()
    await ProductionRun.create({ eventId: event.id, productId: hotdog.id, quantity: 60 })
    await ProductionRun.create({ eventId: event.id, productId: hotdog.id, quantity: 40 })

    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])
    const response = await client.get(`/v1/events/${event.id}/sellable`).loginAs(user)

    const [line] = response.body().data
    assert.equal(line.produced_qty, 100)
    assert.equal(line.remaining_qty, 100)
  })

  test('un produit au menu jamais produit ne se vend pas', async ({ client, assert }) => {
    const { event } = await seed()

    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])
    const response = await client.get(`/v1/events/${event.id}/sellable`).loginAs(user)

    const [line] = response.body().data
    assert.equal(line.produced_qty, 0)
    assert.equal(line.sold_qty, 0)
    assert.equal(line.remaining_qty, 0)
  })

  test('ne descend jamais sous zéro', async ({ client, assert }) => {
    const { event, hotdog } = await seed()
    await ProductionRun.create({ eventId: event.id, productId: hotdog.id, quantity: 10 })
    // Le comptoir peut vendre plus que produit (on assemble à la demande) : le
    // restant se plancher à zéro plutôt que d'afficher un négatif.
    await sell(event.id, hotdog.id, 25)

    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])
    const response = await client.get(`/v1/events/${event.id}/sellable`).loginAs(user)

    const [line] = response.body().data
    assert.equal(line.sold_qty, 25)
    assert.equal(line.remaining_qty, 0)
  })

  test('refuse un membre sans order:read', async ({ client, assert }) => {
    const { event } = await seed()
    const user = await grantPermissions(await MemberFactory.create(), [])

    const response = await client.get(`/v1/events/${event.id}/sellable`).loginAs(user)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_FORBIDDEN')
  })
})
