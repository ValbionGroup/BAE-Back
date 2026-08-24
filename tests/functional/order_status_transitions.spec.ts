import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Order from '#models/order'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

async function makeOrder(status: string) {
  const event = await Event.create({
    name: 'Soirée Hivernale',
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'ongoing',
    duration: 4 * 60 * 60,
  })
  const order = await Order.create({ eventId: event.id, status })
  return { event, order }
}

test.group('Orders — transitions de statut', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('suit le cycle nominal de la cuisine', async ({ client, assert }) => {
    const { order } = await makeOrder('pending')
    const user = await grantPermissions(await MemberFactory.create(), ['order:serve', 'order:read'])

    for (const next of ['in_progress', 'ready', 'completed']) {
      const response = await client
        .patch(`/v1/orders/${order.id}/status`)
        .json({ status: next })
        .loginAs(user)

      response.assertStatus(200)
      assert.equal(response.body().data.status, next)
    }

    await order.refresh()
    assert.equal(order.status, 'completed')
  })

  test('refuse un retour en arrière', async ({ client, assert }) => {
    const { order } = await makeOrder('ready')
    const user = await grantPermissions(await MemberFactory.create(), ['order:serve', 'order:read'])

    // Deux écrans touchent la même commande : sans cette règle, un
    // rafraîchissement tardif ferait reculer une commande déjà prête.
    const response = await client
      .patch(`/v1/orders/${order.id}/status`)
      .json({ status: 'in_progress' })
      .loginAs(user)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_ORDER_INVALID_TRANSITION')
    assert.include(response.body().error.message, 'prête')
    assert.include(response.body().error.message, 'en préparation')

    await order.refresh()
    assert.equal(order.status, 'ready', 'le refus ne doit rien avoir écrit')
  })

  test('une commande servie est immuable', async ({ client, assert }) => {
    const { order } = await makeOrder('completed')
    const user = await grantPermissions(await MemberFactory.create(), ['order:serve', 'order:read'])

    for (const next of ['pending', 'in_progress', 'ready', 'cancelled']) {
      const response = await client
        .patch(`/v1/orders/${order.id}/status`)
        .json({ status: next })
        .loginAs(user)

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_ORDER_INVALID_TRANSITION')
    }
  })

  test('une commande annulée est immuable', async ({ client, assert }) => {
    const { order } = await makeOrder('cancelled')
    const user = await grantPermissions(await MemberFactory.create(), ['order:serve', 'order:read'])

    const response = await client
      .patch(`/v1/orders/${order.id}/status`)
      .json({ status: 'pending' })
      .loginAs(user)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_ORDER_INVALID_TRANSITION')
  })

  test('l’annulation est atteignable depuis les trois états non terminaux', async ({
    client,
    assert,
  }) => {
    const user = await grantPermissions(await MemberFactory.create(), [
      'order:read',
      'order:delete',
    ])

    for (const from of ['pending', 'in_progress', 'ready']) {
      const { order } = await makeOrder(from)

      const response = await client.delete(`/v1/orders/${order.id}`).loginAs(user)

      response.assertStatus(200)
      assert.equal(response.body().data.status, 'cancelled')
    }
  })

  test('annuler exige order:delete, pas seulement order:write', async ({ client, assert }) => {
    const { order } = await makeOrder('pending')
    const user = await grantPermissions(await MemberFactory.create(), ['order:write', 'order:read'])

    const response = await client.delete(`/v1/orders/${order.id}`).loginAs(user)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_FORBIDDEN')
  })

  test('404 explicite sur une commande inconnue', async ({ client, assert }) => {
    const user = await grantPermissions(await MemberFactory.create(), ['order:serve', 'order:read'])

    const response = await client
      .patch('/v1/orders/999999/status')
      .json({ status: 'in_progress' })
      .loginAs(user)

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_ORDER_NOT_FOUND')
  })

  test('refuse un statut hors de la liste', async ({ client }) => {
    const { order } = await makeOrder('pending')
    const user = await grantPermissions(await MemberFactory.create(), ['order:serve', 'order:read'])

    const response = await client
      .patch(`/v1/orders/${order.id}/status`)
      .json({ status: 'en_cuisine' })
      .loginAs(user)

    response.assertStatus(422)
  })
})
