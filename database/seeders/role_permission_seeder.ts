import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import { ROLE_PERMISSIONS, type RoleName } from '#database/rbac_catalog'

export default class extends BaseSeeder {
  async run() {
    const roles = await Role.query().whereIn('name', Object.keys(ROLE_PERMISSIONS))

    for (const role of roles) {
      // `sync()` et non `attach()` : attacher une paire déjà présente viole la clé
      // primaire composite de `roles_permissions`. `sync()` fait en outre du
      // catalogue la référence — une permission retirée de la carte est révoquée.
      await role.related('permissions').sync(ROLE_PERMISSIONS[role.name as RoleName])
    }
  }
}
