import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { RoleFactory } from '#database/factories/role_factory'

export default class extends BaseSeeder {
  async run() {
    // Write your database queries inside the run method
    await RoleFactory.createMany(5)
  }
}
