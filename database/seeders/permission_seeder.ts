import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'
import { PERMISSIONS } from '#database/rbac_catalog'

export default class extends BaseSeeder {
  async run() {
    await Permission.fetchOrCreateMany(
      'permission',
      PERMISSIONS.map((permission) => ({ permission }))
    )
  }
}
