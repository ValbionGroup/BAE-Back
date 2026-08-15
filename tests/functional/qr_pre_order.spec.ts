import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import PreOrder from '#models/pre_order'
import Product from '#models/product'
import Transaction from '#models/transaction'
import JwtService from '#services/jwt_service'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

async function seedPreOrder(userId: number, options: { paid: boolean; received?: number }) {
  const event = await Event.create({
    name: 'Soirée Hivernale',
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'ongoing',
    duration: 4,
  })
  const product = await Product.create({
    name: 'Hot-dog classique',
    isVegetarian: false,
    description: null,
    recipe: null,
  })

  const transaction = options.paid
    ? await Transaction.create({ type: 'cash', amount: '7.00' })
    : null

  const preOrder = await PreOrder.create({
    userId,
    eventId: event.id,
    transactionId: transaction?.id ?? null,
  })

  await db.table('pre_order_items').insert({
    pre_order_id: preOrder.id,
    product_id: product.id,
    quantity: 2,
    received_quantity: options.received ?? 0,
    created_at: DateTime.now().toSQL({ includeOffset: false }),
    updated_at: DateTime.now().toSQL({ includeOffset: false }),
  })

  return { event, product, preOrder }
}

function tokenFor(preOrderId: number, userId: number, eventId: number) {
  return new JwtService().generateQrToken({ type: 'pre_order', userId, preOrderId, eventId })
}

test.group('QR de précommande — retrait au comptoir', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('affiche la commande et signale qu’elle est déjà payée', async ({ client, assert }) => {
    const owner = await MemberFactory.merge({ firstName: 'Tom', lastName: 'Bessiere' }).create()
    const { preOrder, event } = await seedPreOrder(owner.id, { paid: true })
    const cashier = await grantPermissions(await MemberFactory.create(), ['order:write'])

    const token = await tokenFor(preOrder.id, owner.id, event.id)
    const response = await client.post('/v1/qr/verify').json({ token }).loginAs(cashier)

    response.assertStatus(200)
    const body = response.body().data
    assert.equal(body.kind, 'pre_order')
    assert.equal(body.buyer.name, 'Tom Bessiere')
    // C'est ce drapeau qui dit au comptoir de laisser passer sans encaisser.
    assert.isTrue(body.pre_order.paid)
    assert.isFalse(body.pre_order.fully_collected)
    assert.equal(body.pre_order.lines[0].product_name, 'Hot-dog classique')
    assert.equal(body.pre_order.lines[0].quantity, 2)
  })

  test('signale une précommande non payée — le comptoir doit encaisser', async ({
    client,
    assert,
  }) => {
    const owner = await MemberFactory.create()
    const { preOrder, event } = await seedPreOrder(owner.id, { paid: false })
    const cashier = await grantPermissions(await MemberFactory.create(), ['order:write'])

    const token = await tokenFor(preOrder.id, owner.id, event.id)
    const response = await client.post('/v1/qr/verify').json({ token }).loginAs(cashier)

    response.assertStatus(200)
    assert.isFalse(response.body().data.pre_order.paid)
  })

  test('signale une précommande déjà entièrement retirée', async ({ client, assert }) => {
    const owner = await MemberFactory.create()
    const { preOrder, event } = await seedPreOrder(owner.id, { paid: true, received: 2 })
    const cashier = await grantPermissions(await MemberFactory.create(), ['order:write'])

    const token = await tokenFor(preOrder.id, owner.id, event.id)
    const response = await client.post('/v1/qr/verify').json({ token }).loginAs(cashier)

    response.assertStatus(200)
    assert.isTrue(response.body().data.pre_order.fully_collected)
  })

  test('refuse un QR signé pour un autre compte', async ({ client, assert }) => {
    const owner = await MemberFactory.create()
    const intruder = await MemberFactory.create()
    const { preOrder, event } = await seedPreOrder(owner.id, { paid: true })
    const cashier = await grantPermissions(await MemberFactory.create(), ['order:write'])

    const token = await tokenFor(preOrder.id, intruder.id, event.id)
    const response = await client.post('/v1/qr/verify').json({ token }).loginAs(cashier)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_PRE_ORDER_MISMATCH')
  })

  test('404 sur une précommande inconnue', async ({ client, assert }) => {
    const owner = await MemberFactory.create()
    const cashier = await grantPermissions(await MemberFactory.create(), ['order:write'])

    const token = await tokenFor(999999, owner.id, 1)
    const response = await client.post('/v1/qr/verify').json({ token }).loginAs(cashier)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_PRE_ORDER_NOT_FOUND')
  })
})
