import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Supplier from '#models/supplier'

const RETAILERS = ['Leclerc', 'Auchan', 'Carrefour'] as const

export default class extends BaseSeeder {
  async run() {
    await Supplier.fetchOrCreateMany(
      'name',
      RETAILERS.map((name) => ({ name }))
    )
  }
}
