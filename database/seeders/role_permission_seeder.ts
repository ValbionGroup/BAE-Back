import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Permission from '#models/permission'
import Role from '#models/role'

export default class extends BaseSeeder {
  async run() {
    // Write your database queries inside the run method
    const roles = await Role.all()
    const permissions = await Permission.all()
  }
}