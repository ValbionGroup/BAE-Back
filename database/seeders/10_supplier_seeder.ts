import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DEMO_ONLY } from '#database/seeder_environment'
import Supplier from '#models/supplier'

const RETAILERS = ['Leclerc', 'Auchan', 'Carrefour'] as const

export default class extends BaseSeeder {
  static environment = DEMO_ONLY

  async run() {
    await Supplier.fetchOrCreateMany(
      'name',
      RETAILERS.map((name) => ({ name }))
    )
  }
}
