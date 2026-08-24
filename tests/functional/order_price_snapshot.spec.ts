import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import Order from '#models/order'
import Product from '#models/product'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

const HOTDOG_CENTS = 250

async function seedMenu(price = HOTDOG_CENTS) {
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

  await event.related('products').attach({ [hotdog.id]: { quantity: 200, price } })

  return { event, hotdog }
}

function seller() {
  return MemberFactory.create().then((member) =>
    grantPermissions(member, ['order:write', 'order:read'])
  )
}

test.group('Orders — prix figé à la vente', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('écrit le prix facturé et le prix public dans order_products', async ({
    client,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    const user = await seller()

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 2 }] })
      .loginAs(user)

    response.assertStatus(201)

    const order = await Order.query().where('eventId', event.id).firstOrFail()
    const line = await db.from('order_products').where('order_id', order.id).firstOrFail()

    assert.equal(Number(line.unit_price_cents), HOTDOG_CENTS)
    // Aucune règle tarifaire n'existe : facturé et public sont encore égaux.
    assert.equal(Number(line.list_price_cents), HOTDOG_CENTS)
  })

  test('relit une commande à son prix d’époque, pas au prix courant du menu', async ({
    client,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    const user = await seller()

    const created = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 2 }] })
      .loginAs(user)
    created.assertStatus(201)
    assert.equal(created.body().data.total_cents, 500)

    // Le prix de la soirée double APRÈS la vente. C'est le cas que le
    // recalcul depuis `event_products` traitait faux : il réécrivait le passé.
    await db
      .from('event_products')
      .where('event_id', event.id)
      .where('product_id', hotdog.id)
      .update({ price: HOTDOG_CENTS * 2 })

    const listed = await client.get(`/v1/events/${event.id}/orders`).loginAs(user)
    listed.assertStatus(200)

    const [payload] = listed.body().data
    assert.equal(payload.total_cents, 500, 'la commande vaut toujours ce qui a été encaissé')
    assert.equal(payload.lines[0].unit_price, HOTDOG_CENTS)
  })

  test('expose brut, remise et net, dont l’écart est nul sans remise', async ({
    client,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    const user = await seller()

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 3 }] })
      .loginAs(user)

    response.assertStatus(201)

    const data = response.body().data
    assert.equal(data.gross_cents, 750)
    assert.equal(data.discount_cents, 0)
    assert.equal(data.total_cents, 750)
    assert.deepEqual(data.discounts, [])
  })

  test('retranche une remise de commande du net, et la garde lisible', async ({
    client,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    const user = await seller()

    const created = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 4 }] })
      .loginAs(user)
    created.assertStatus(201)

    // Écrite à la main : aucune règle tarifaire ne les produit encore. Le test
    // éprouve la lecture, qui est ce que ce lot livre.
    await db.table('order_discounts').insert({
      order_id: created.body().data.id,
      product_id: null,
      label: 'Staff BDE −50 %',
      amount_cents: 500,
      applied_by_user_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    })

    const listed = await client.get(`/v1/events/${event.id}/orders`).loginAs(user)
    const [payload] = listed.body().data

    assert.equal(payload.gross_cents, 1000)
    assert.equal(payload.discount_cents, 500)
    assert.equal(payload.total_cents, 500)
    assert.equal(payload.discounts[0].label, 'Staff BDE −50 %')
  })

  test('compte un prix de ligne inférieur au public comme une remise', async ({
    client,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    const user = await seller()

    const created = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 2 }] })
      .loginAs(user)
    created.assertStatus(201)

    // Ce qu'écrira une règle `override` : facturé 2,00 € au lieu de 2,50 €.
    await db
      .from('order_products')
      .where('order_id', created.body().data.id)
      .update({ unit_price_cents: 200 })

    const listed = await client.get(`/v1/events/${event.id}/orders`).loginAs(user)
    const [payload] = listed.body().data

    assert.equal(payload.gross_cents, 500)
    assert.equal(payload.total_cents, 400)
    assert.equal(payload.discount_cents, 100, 'l’écart de ligne est une remise, lui aussi')
  })
})
