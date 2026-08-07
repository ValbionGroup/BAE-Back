import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Role from '#models/role'
import Permission from '#models/permission'
import { MemberFactory } from '#database/factories/members_factory'

test.group('Roles permissions exposure', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('GET /v1/roles exposes the permissions granted to each role', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)

    await Permission.firstOrCreate({ permission: 'stock:read' })
    await Permission.firstOrCreate({ permission: 'log:read' })
    const role = await Role.create({ name: 'Pole Test' })
    await role.related('permissions').sync(['stock:read'])

    const response = await client.get('/v1/roles').loginAs(user)
    const body = response.body() as {
      data: Array<{ id: number; permissions: Array<{ permission: string }> }>
    }
    const row = body.data.find((entry) => entry.id === role.id)

    assert.deepEqual(
      row?.permissions.map((entry) => entry.permission),
      ['stock:read']
    )
  })
})
