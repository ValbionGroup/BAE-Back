import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { PermissionFactory } from '#database/factories/permission_factory'

export default class extends BaseSeeder {
  async run() {
    // Write your database queries inside the run method
    await PermissionFactory.createMany(5)
  }
}