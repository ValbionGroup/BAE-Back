import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Permission from '#models/permission'
import { UserFactory } from '#database/factories/user_factory'
import { MemberFactory } from '#database/factories/members_factory'
import { RoleFactory } from '#database/factories/role_factory'

test.group('Logs authorization', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function permission() {
    return Permission.firstOrCreate({ permission: 'log:read' }, { permission: 'log:read' })
  }

  async function userWithRole(granted: boolean) {
    const role = await RoleFactory.create()
    if (granted) {
      const perm = await permission()
      await role.related('permissions').attach([perm.permission])
    }
    // `MemberFactory` creates its OWN user in a `before('create')` hook and
    // overwrites `member.id` with it: passing an existing user id through
    // `merge()` is silently discarded. So let the factory make the pair, then read
    // the user back off the member.
    const member = await MemberFactory.merge({ roleId: role.id }).create()
    return member.user
  }

  test('grants access to a role holding log:read', async ({ client }) => {
    const user = await userWithRole(true)

    const response = await client.get('/v1/logs').loginAs(user)

    response.assertStatus(200)
  })

  test('refuses a role without log:read', async ({ client }) => {
    const user = await userWithRole(false)

    const response = await client.get('/v1/logs').loginAs(user)

    response.assertStatus(403)
  })

  test('refuses a user with no member row at all', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client.get('/v1/logs').loginAs(user)

    response.assertStatus(403)
  })

  test('still refuses anonymous callers with 401, not 403', async ({ client }) => {
    const response = await client.get('/v1/logs')

    response.assertStatus(401)
  })

  test('gates the write routes too, not just the listing', async ({ client }) => {
    const user = await userWithRole(false)

    const response = await client.post('/v1/logs').loginAs(user).json({
      level: 'info',
      message: 'should never be written',
    })

    response.assertStatus(403)
  })
})
