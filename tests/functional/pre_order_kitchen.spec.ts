import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import PreOrder from '#models/pre_order'
import Product from '#models/product'
import Client from '#models/client'
import Transaction from '#models/transaction'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

async function seed(options: { paid?: boolean; pickupInMinutes?: number | null } = {}) {
  const event = await Event.create({
    name: 'Soirée Hivernale',
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'ongoing',
    duration: 4 * 60 * 60,
  })
  const product = await Product.create({
    name: 'Hot-dog classique',
    isVegetarian: false,
    description: null,
    recipe: null,
  })
  const owner = await MemberFactory.with('user', 1, (u) =>
    u.merge({ firstName: 'Tom', lastName: 'Bessiere' })
  ).create()

  const transaction =
    options.paid === false ? null : await Transaction.create({ type: 'lydia', amount: 700 })

  const pickupAt =
    options.pickupInMinutes === null || options.pickupInMinutes === undefined
      ? null
      : DateTime.now().plus({ minutes: options.pickupInMinutes })

  const preOrder = await PreOrder.create({
    userId: owner.id,
    eventId: event.id,
    transactionId: transaction?.id ?? null,
    pickupAt,
  })

  await db.table('pre_order_items').insert({
    pre_order_id: preOrder.id,
    product_id: product.id,
    quantity: 2,
    received_quantity: 0,
    created_at: DateTime.now().toSQL({ includeOffset: false }),
    updated_at: DateTime.now().toSQL({ includeOffset: false }),
  })

  return { event, product, owner, preOrder }
}

test.group('Précommandes — file cuisine', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('une précommande proche de son heure est à préparer', async ({ client, assert }) => {
    const { event } = await seed({ pickupInMinutes: 10 })
    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])

    const response = await client.get(`/v1/events/${event.id}/pre-orders`).loginAs(user)

    response.assertStatus(200)
    const [ticket] = response.body().data
    assert.isTrue(ticket.due)
    assert.equal(ticket.reference, 'P1')
    assert.equal(ticket.status, 'pending')
    assert.equal(ticket.client_name, 'Tom Bessiere')
  })

  // Épingle le seuil lui-même : à 20 minutes, la précommande attend encore.
  // Sans ce cas, remonter `PREPARE_LEAD_MINUTES` ne casserait aucun test.
  test('une précommande au-delà du délai de préparation attend', async ({ client, assert }) => {
    const { event } = await seed({ pickupInMinutes: 20 })
    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])

    const response = await client.get(`/v1/events/${event.id}/pre-orders`).loginAs(user)

    assert.isFalse(response.body().data[0].due)
  })

  test('une précommande lointaine n’encombre pas encore la cuisine', async ({ client, assert }) => {
    const { event } = await seed({ pickupInMinutes: 240 })
    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])

    const response = await client.get(`/v1/events/${event.id}/pre-orders`).loginAs(user)

    assert.isFalse(response.body().data[0].due)
  })

  test('une précommande sans heure est à préparer dès l’ouverture', async ({ client, assert }) => {
    const { event } = await seed({ pickupInMinutes: null })
    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])

    const response = await client.get(`/v1/events/${event.id}/pre-orders`).loginAs(user)

    // Mieux vaut préparer trop tôt que la voir disparaître de la file.
    assert.isTrue(response.body().data[0].due)
    assert.isNull(response.body().data[0].pickup_at)
  })

  test('suit le même cycle que la cuisine', async ({ client, assert }) => {
    const { preOrder } = await seed({ pickupInMinutes: 10 })
    const user = await grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])

    for (const next of ['in_progress', 'ready']) {
      const response = await client
        .patch(`/v1/pre-orders/${preOrder.id}/status`)
        .json({ status: next })
        .loginAs(user)

      response.assertStatus(200)
      assert.equal(response.body().data.status, next)
    }
  })

  test('refuse un retour en arrière, comme pour une commande', async ({ client, assert }) => {
    const { preOrder } = await seed({ pickupInMinutes: 10 })
    const user = await grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])

    await client
      .patch(`/v1/pre-orders/${preOrder.id}/status`)
      .json({ status: 'in_progress' })
      .loginAs(user)
    await client
      .patch(`/v1/pre-orders/${preOrder.id}/status`)
      .json({ status: 'ready' })
      .loginAs(user)

    const response = await client
      .patch(`/v1/pre-orders/${preOrder.id}/status`)
      .json({ status: 'in_progress' })
      .loginAs(user)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_ORDER_INVALID_TRANSITION')
  })
})

test.group('Précommandes — remise', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('remet tout d’un coup et clôt la précommande', async ({ client, assert }) => {
    const { preOrder } = await seed({ pickupInMinutes: 10 })
    const user = await grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])

    const response = await client.post(`/v1/pre-orders/${preOrder.id}/collect`).loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.body().data.fully_collected)
    assert.equal(response.body().data.status, 'completed')

    // La colonne garde le grain fin, même si la remise est totale.
    const rows = await db.from('pre_order_items').where('pre_order_id', preOrder.id)
    assert.equal(Number(rows[0].received_quantity), Number(rows[0].quantity))
  })

  test('refuse une seconde remise', async ({ client, assert }) => {
    const { preOrder } = await seed({ pickupInMinutes: 10 })
    const user = await grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])

    await client.post(`/v1/pre-orders/${preOrder.id}/collect`).loginAs(user)
    const response = await client.post(`/v1/pre-orders/${preOrder.id}/collect`).loginAs(user)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_PRE_ORDER_ALREADY_COLLECTED')
  })

  test('refuse de remettre une précommande sans paiement rattaché', async ({ client, assert }) => {
    const { preOrder } = await seed({ paid: false, pickupInMinutes: 10 })
    const user = await grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])

    const response = await client.post(`/v1/pre-orders/${preOrder.id}/collect`).loginAs(user)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_PRE_ORDER_UNPAID')
  })

  test('remettre exige order:write', async ({ client, assert }) => {
    const { preOrder } = await seed({ pickupInMinutes: 10 })
    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])

    const response = await client.post(`/v1/pre-orders/${preOrder.id}/collect`).loginAs(user)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_FORBIDDEN')
  })
})

test.group('Précommandes — consigne du client', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('le ticket porte la consigne de préparation', async ({ client, assert }) => {
    const { event, owner } = await seed({ pickupInMinutes: 10 })
    await Client.create({
      id: owner.id,
      registeredAt: DateTime.now(),
      preparationNote: 'Allergie arachide',
    })
    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])

    const response = await client.get(`/v1/events/${event.id}/pre-orders`).loginAs(user)

    const [ticket] = response.body().data
    assert.equal(ticket.preparation_note, 'Allergie arachide')
  })

  test('sans consigne, le champ est nul plutôt qu’absent', async ({ client, assert }) => {
    const { event, owner } = await seed({ pickupInMinutes: 10 })
    await Client.create({ id: owner.id, registeredAt: DateTime.now() })
    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])

    const response = await client.get(`/v1/events/${event.id}/pre-orders`).loginAs(user)

    const [ticket] = response.body().data
    assert.isNull(ticket.preparation_note)
  })

  /**
   * `findTicket` reconstruit le ticket par un autre chemin. Sans ce test, la
   * consigne disparaîtrait de l'écran au premier changement de statut.
   */
  test('la consigne survit à un changement de statut', async ({ client, assert }) => {
    const { owner, preOrder } = await seed({ pickupInMinutes: 10 })
    await Client.create({
      id: owner.id,
      registeredAt: DateTime.now(),
      preparationNote: 'Allergie arachide',
    })
    const user = await grantPermissions(await MemberFactory.create(), [
      'order:read',
      'order:write',
    ])

    const response = await client
      .patch(`/v1/pre-orders/${preOrder.id}/status`)
      .json({ status: 'in_progress' })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.preparation_note, 'Allergie arachide')
  })
})
