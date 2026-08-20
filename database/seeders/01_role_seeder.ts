import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import { ROLES } from '#database/rbac_catalog'

export default class extends BaseSeeder {
  async run() {
    await Role.fetchOrCreateMany(
      'name',
      ROLES.map((name) => ({ name }))
    )
  }
}
