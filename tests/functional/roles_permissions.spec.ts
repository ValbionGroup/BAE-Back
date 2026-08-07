import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Role from '#models/role'
import Permission from '#models/permission'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

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

  test('PUT /v1/roles/:id/permissions replaces the whole list', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['role:write'])

    await Permission.firstOrCreate({ permission: 'stock:read' })
    await Permission.firstOrCreate({ permission: 'log:read' })
    const role = await Role.create({ name: 'Pole Sync' })
    await role.related('permissions').sync(['stock:read'])

    const response = await client
      .put(`/v1/roles/${role.id}/permissions`)
      .json({ permissions: ['log:read'] })
      .loginAs(user)

    response.assertStatus(200)

    await role.load('permissions')
    assert.deepEqual(
      role.permissions.map((entry) => entry.permission),
      ['log:read'],
      'la liste envoyée remplace la précédente, elle ne s’y ajoute pas'
    )
  })

  test('PUT /v1/roles/:id/permissions rejects a permission outside the catalog', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['role:write'])

    await Permission.firstOrCreate({ permission: 'stock:read' })
    const role = await Role.create({ name: 'Pole Invalide' })
    await role.related('permissions').sync(['stock:read'])

    const response = await client
      .put(`/v1/roles/${role.id}/permissions`)
      .json({ permissions: ['stock:read', 'banane:manger'] })
      .loginAs(user)

    response.assertStatus(422)

    await role.load('permissions')
    assert.deepEqual(
      role.permissions.map((entry) => entry.permission),
      ['stock:read'],
      'un corps invalide ne doit rien écrire, pas même la partie valide'
    )
  })
})
