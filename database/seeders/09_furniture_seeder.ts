import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DEMO_ONLY } from '#database/seeder_environment'
import Furniture from '#models/furniture'

// Prix en **centimes**, comme toute valeur monétaire depuis le 2026-08-25.
const FURNITURES: readonly { name: string; price: number; quantity: number }[] = [
  { name: 'Serviette papier', price: 1, quantity: 800 },
  { name: 'Barquette carton', price: 8, quantity: 300 },
  { name: 'Gobelet 20cl', price: 3, quantity: 500 },
  { name: 'Couvert plastique', price: 2, quantity: 600 },
  { name: 'Nappe jetable', price: 45, quantity: 15 },
  { name: 'Sac poubelle 50L', price: 15, quantity: 60 },
]

export default class extends BaseSeeder {
  static environment = DEMO_ONLY

  async run() {
    await Furniture.fetchOrCreateMany(
      'name',
      FURNITURES.map((furniture) => ({
        name: furniture.name,
        price: furniture.price,
        quantity: furniture.quantity,
      }))
    )
  }
}
