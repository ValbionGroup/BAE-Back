import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { OrderFactory } from '#database/factories/order_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { ROLE_PERMISSIONS } from '#database/rbac_catalog'

test.group('order:serve — servir n’est pas encaisser', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function scene(permissions: string[]) {
    const member = await MemberFactory.create()
    const user =
      permissions.length > 0
        ? await grantPermissions(member, permissions)
        : await User.findOrFail(member.id)
    const event = await EventFactory.create()
    const order = await OrderFactory.merge({ eventId: event.id, status: 'pending' }).create()
    return { user, event, order }
  }

  test('order:serve fait avancer un ticket en cuisine', async ({ client }) => {
    const { user, order } = await scene(['order:serve'])

    const response = await client
      .patch(`/v1/orders/${order.id}/status`)
      .json({ status: 'in_progress' })
      .loginAs(user)

    response.assertStatus(200)
  })

  test('order:serve n’ouvre pas la caisse', async ({ client }) => {
    const { user, event } = await scene(['order:serve'])

    const response = await client.post(`/v1/events/${event.id}/orders`).json({ lines: [] }).loginAs(user)

    response.assertStatus(403)
  })

  // Le cœur du découpage : avant ce lot, `order:write` portait les deux gestes.
  // Si ce test passe au vert sans `order:serve`, la fusion est revenue.
  test('order:write seul ne fait plus avancer un ticket', async ({ client }) => {
    const { user, order } = await scene(['order:write'])

    const response = await client
      .patch(`/v1/orders/${order.id}/status`)
      .json({ status: 'in_progress' })
      .loginAs(user)

    response.assertStatus(403)
  })
})

test.group('order:serve — place dans le catalogue', () => {
  test('tous les rôles la portent : le kitchen display est ouvert à tout membre', ({ assert }) => {
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      assert.include(permissions, 'order:serve', `${role} devrait porter order:serve`)
      assert.include(permissions, 'order:read', `${role} devrait porter order:read`)
    }
  })

  test('le Pole BBQ tient la cuisine, pas le comptoir', ({ assert }) => {
    assert.include(ROLE_PERMISSIONS['Pole BBQ'], 'order:serve')
    assert.notInclude(ROLE_PERMISSIONS['Pole BBQ'], 'order:write')
  })

  test('la caisse reste aux rôles qui encaissent', ({ assert }) => {
    assert.include(ROLE_PERMISSIONS['Tresorier'], 'order:write')
    assert.include(ROLE_PERMISSIONS['Coordinateur'], 'order:write')
    assert.notInclude(ROLE_PERMISSIONS['Membre'], 'order:write')
  })
})
