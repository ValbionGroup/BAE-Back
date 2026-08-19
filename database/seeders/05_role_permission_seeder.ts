import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import { ROLE_PERMISSIONS, type RoleName } from '#database/rbac_catalog'

export default class extends BaseSeeder {
  async run() {
    const roles = await Role.query().whereIn('name', Object.keys(ROLE_PERMISSIONS))

    for (const role of roles) {
      await role.related('permissions').sync(ROLE_PERMISSIONS[role.name as RoleName])
    }
  }
}
