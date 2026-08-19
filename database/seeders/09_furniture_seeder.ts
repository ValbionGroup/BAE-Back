import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Furniture from '#models/furniture'

const FURNITURES: readonly { name: string; price: number; quantity: number }[] = [
  { name: 'Serviette papier', price: 0.01, quantity: 800 },
  { name: 'Barquette carton', price: 0.08, quantity: 300 },
  { name: 'Gobelet 20cl', price: 0.03, quantity: 500 },
  { name: 'Couvert plastique', price: 0.02, quantity: 600 },
  { name: 'Nappe jetable', price: 0.45, quantity: 15 },
  { name: 'Sac poubelle 50L', price: 0.15, quantity: 60 },
]

export default class extends BaseSeeder {
  async run() {
    await Furniture.fetchOrCreateMany(
      'name',
      FURNITURES.map((furniture) => ({
        name: furniture.name,
        price: furniture.price.toFixed(2),
        quantity: furniture.quantity,
      }))
    )
  }
}
