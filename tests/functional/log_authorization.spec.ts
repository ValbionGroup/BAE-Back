import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Permission from '#models/permission'
import Log from '#models/log'
import { LogFactory } from '#database/factories/log_factory'
import { UserFactory } from '#database/factories/user_factory'
import { MemberFactory } from '#database/factories/members_factory'
import { RoleFactory } from '#database/factories/role_factory'

test.group('Logs authorization', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function permission(name: string) {
    return Permission.firstOrCreate({ permission: name }, { permission: name })
  }

  async function userWithRole(granted: boolean, names = ['log:read']) {
    const role = await RoleFactory.create()
    if (granted) {
      const perms = await Promise.all(names.map(permission))
      await role.related('permissions').attach(perms.map((entry) => entry.permission))
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

  test('exposes no write route: the journal is written by the middleware alone', async ({
    client,
  }) => {
    const user = await userWithRole(true)

    const created = await client.post('/v1/logs').loginAs(user).json({
      level: 'info',
      message: 'should never be written',
    })
    const updated = await client.patch('/v1/logs/1').loginAs(user).json({ message: 'tampered' })

    created.assertStatus(404)
    updated.assertStatus(404)
  })

  // La faille que ce test ferme : `log:read` ouvrait aussi la suppression, donc
  // son porteur pouvait effacer la trace de ses propres actions.
  test('refuses deletion to a role holding only log:read', async ({ client }) => {
    const user = await userWithRole(true)
    const log = await LogFactory.create()

    const response = await client.delete(`/v1/logs/${log.id}`).loginAs(user)

    response.assertStatus(403)
  })

  test('allows deletion to a role holding log:delete', async ({ client, assert }) => {
    const user = await userWithRole(true, ['log:read', 'log:delete'])
    const log = await LogFactory.create()

    const response = await client.delete(`/v1/logs/${log.id}`).loginAs(user)

    response.assertStatus(200)
    assert.isNull(await Log.find(log.id))
  })
})
