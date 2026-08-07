import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
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

  test('refuses a sync that leaves nobody holding role:write', async ({ client, assert }) => {
    // La base peut déjà contenir d'autres porteurs de role:write (comptes admin
    // réels en dev, rôles seedés) : sans les retirer ici, le compte global ne
    // retombe jamais à zéro et le test ne prouve rien, seedée ou non.
    await db.from('roles_permissions').where('permission_id', 'role:write').delete()

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['role:write'])
    const role = await Role.findOrFail(member.roleId)

    const response = await client
      .put(`/v1/roles/${role.id}/permissions`)
      .json({ permissions: [] })
      .loginAs(user)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_RBAC_LOCKOUT')
    assert.equal(
      response.body().error.message,
      'Accordez d’abord role:write à un rôle occupé avant de la retirer ici.'
    )

    await role.load('permissions')
    assert.deepEqual(
      role.permissions.map((entry) => entry.permission),
      ['role:write'],
      'le refus doit annuler le sync, pas le laisser à moitié appliqué'
    )
  })

  test('allows stripping role:write from a role nobody holds', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['role:write'])

    await Permission.firstOrCreate({ permission: 'role:write' })
    const vacant = await Role.create({ name: 'Pole Vacant' })
    await vacant.related('permissions').sync(['role:write'])

    const response = await client
      .put(`/v1/roles/${vacant.id}/permissions`)
      .json({ permissions: [] })
      .loginAs(user)

    response.assertStatus(200)

    await vacant.load('permissions')
    assert.isEmpty(
      vacant.permissions,
      'un rôle sans membre n’est pas un porteur : le retirer ne verrouille rien'
    )
  })

  test('the permission catalog cannot be written over HTTP', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['role:write'])

    const response = await client
      .post('/v1/permissions')
      .json({ permission: 'banane:manger' })
      .loginAs(user)

    response.assertStatus(404)
  })
})
