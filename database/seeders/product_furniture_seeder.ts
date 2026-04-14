import Furniture from '#models/furniture'
import Product from '#models/product'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    // Write your database queries inside the run method.
    const products = await Product.all()
    const funrnitures = await Furniture.all()

    for (const product of products) {
      await product.related('furnitures').sync({
        [funrnitures[0].id]: { quantity: 2 },
        [funrnitures[1].id]: { quantity: 5 },
      })
    }
  }
}