import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Role from '#models/role'
import RoleSeeder from '#database/seeders/role_seeder'
import PermissionSeeder from '#database/seeders/permission_seeder'
import RolePermissionSeeder from '#database/seeders/role_permission_seeder'
import { ROLES, ROLE_PERMISSIONS } from '#database/rbac_catalog'

test.group('RBAC seeding', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function seed() {
    const client = db.connection()
    await new RoleSeeder(client).run()
    await new PermissionSeeder(client).run()
    await new RolePermissionSeeder(client).run()
  }

  test('seeding twice leaves each catalog role once, with exactly its permissions', async ({
    assert,
  }) => {
    await seed()
    await seed()

    for (const name of ROLES) {
      const rows = await Role.query().where('name', name).preload('permissions')

      assert.lengthOf(rows, 1, `le rôle ${name} doit exister exactement une fois`)
      assert.sameMembers(
        rows[0].permissions.map((entry) => entry.permission),
        ROLE_PERMISSIONS[name],
        `permissions du rôle ${name}`
      )
    }
  })

  test('grants menu:read to every role and menu:write only to the menu owners', async ({
    assert,
  }) => {
    await seed()

    const roles = await Role.query().preload('permissions')
    const held = (name: string) =>
      roles.find((role) => role.name === name)!.permissions.map((entry) => entry.permission)

    // Socle : les huit rôles lisent le menu, `Membre` compris.
    for (const role of ROLES) {
      assert.include(held(role), 'menu:read', `${role} devrait porter menu:read`)
    }

    assert.include(held('Coordinateur'), 'menu:write')
    assert.include(held('Pole Log'), 'menu:write')
    assert.notInclude(held('Membre'), 'menu:write')
    assert.notInclude(held('Secretaire'), 'menu:write')
  })
})
