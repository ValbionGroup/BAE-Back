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
})
