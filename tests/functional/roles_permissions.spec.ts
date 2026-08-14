import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Role from '#models/role'
import Permission from '#models/permission'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

test.group('Roles permissions exposure', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('GET /v1/roles exposes the permissions granted to each role', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['role:read'])

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

  test('refuses a sync that leaves nobody holding role:read', async ({ client, assert }) => {
    // Same reasoning as the role:write case above: clear other holders first, or
    // the global count never reaches zero and the test proves nothing.
    await db.from('roles_permissions').where('permission_id', 'role:read').delete()

    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['role:write', 'role:read'])
    const role = await Role.findOrFail(member.roleId)

    const response = await client
      .put(`/v1/roles/${role.id}/permissions`)
      .json({ permissions: ['role:write'] })
      .loginAs(user)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_RBAC_LOCKOUT')
    assert.equal(
      response.body().error.message,
      'Accordez d’abord role:read à un rôle occupé avant de la retirer ici.'
    )

    await role.load('permissions')
    assert.sameMembers(
      role.permissions.map((entry) => entry.permission),
      ['role:write', 'role:read'],
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

  test('GET /v1/roles is closed to a member without role:read', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['presence:read'])

    const response = await client.get('/v1/roles').loginAs(user)

    response.assertStatus(403)
    const body = response.body() as unknown as { error: { code: string; message: string } }
    assert.equal(body.error.code, 'E_FORBIDDEN')
    assert.equal(body.error.message, 'Missing permission: role:read')
  })

  test('GET /v1/roles is open to a member with role:read', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['role:read'])

    const response = await client.get('/v1/roles').loginAs(user)

    response.assertStatus(200)
  })

  test('GET /v1/members stays open to an ordinary member', async ({ client }) => {
    // `member:read` est dans le socle : Coordination, Accueil et Mes présences
    // appellent cette route. La restreindre casse l'accueil de tout le monde.
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['presence:read', 'member:read'])

    const response = await client.get('/v1/members').loginAs(user)

    response.assertStatus(200)
  })
})

test.group('Roles permissions — concurrent syncs', () => {
  // Deliberately NOT `testUtils.db().withGlobalTransaction()`: that hook makes
  // every `db.transaction()` opened during the test reuse the same wrapping
  // transaction as a savepoint on ONE physical connection — a single Postgres
  // session can't have two overlapping transactions, so the race this test
  // exists to reproduce could never actually happen under it. Real, separate
  // connections are required, so this group commits for real and cleans up by
  // hand instead of relying on rollback.
  test('two concurrent syncs on different roles cannot both empty role:write', async ({
    client,
    assert,
  }) => {
    // `created_at` is `notNullable` with no column default (see the migration),
    // so restoring these rows later needs the original value, not a fresh one.
    const otherHolders = await db
      .from('roles_permissions')
      .where('permission_id', 'role:write')
      .select('role_id', 'created_at')

    await db.from('roles_permissions').where('permission_id', 'role:write').delete()

    // Rien ne seede le catalogue pour les tests : sans cette ligne, les `sync`
    // ci-dessous violent la clé étrangère sur `permissions` dès que la base ne
    // contient pas déjà `role:write`.
    await Permission.firstOrCreate({ permission: 'role:write' })

    const roleA = await Role.create({ name: 'Pole Concurrent A' })
    const roleB = await Role.create({ name: 'Pole Concurrent B' })
    await roleA.related('permissions').sync(['role:write'])
    await roleB.related('permissions').sync(['role:write'])

    const memberA = await MemberFactory.create()
    memberA.roleId = roleA.id
    await memberA.save()
    const userA = await User.findOrFail(memberA.id)

    const memberB = await MemberFactory.create()
    memberB.roleId = roleB.id
    await memberB.save()
    const userB = await User.findOrFail(memberB.id)

    try {
      // Neither request is awaited individually before the other is issued: both
      // hit the server, and therefore both open their own `db.transaction()` on
      // their own connection, before either has a chance to commit. That is what
      // makes this a genuine interleaving rather than two sequential calls that
      // happen to be wrapped in the same `Promise.all`.
      const [responseA, responseB] = await Promise.all([
        client.put(`/v1/roles/${roleA.id}/permissions`).json({ permissions: [] }).loginAs(userA),
        client.put(`/v1/roles/${roleB.id}/permissions`).json({ permissions: [] }).loginAs(userB),
      ])

      const statuses = [responseA.status(), responseB.status()].sort((a, b) => a - b)
      assert.deepEqual(
        statuses,
        [200, 409],
        'exactly one of the two concurrent syncs must be refused — never both accepted, never both refused'
      )

      const remaining = await db
        .from('roles_permissions')
        .where('permission_id', 'role:write')
        .count('* as total')
      assert.equal(
        Number(remaining[0].total),
        1,
        'the invariant must hold after the race: role:write still has exactly one living holder'
      )
    } finally {
      // `members.id` cascades from `users.id`, so deleting the users is enough to
      // remove the member rows too.
      await userA.delete()
      await userB.delete()
      await roleA.delete()
      await roleB.delete()
      if (otherHolders.length > 0) {
        await db.table('roles_permissions').insert(
          otherHolders.map((row) => ({
            role_id: row.role_id,
            permission_id: 'role:write',
            created_at: row.created_at,
          }))
        )
      }
    }
  })
})
