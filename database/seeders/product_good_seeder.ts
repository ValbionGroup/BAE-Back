import Good from '#models/good'
import Product from '#models/product'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    // Write your database queries inside the run method
    const products = await Product.all()
    const goods = await Good.all()

    if (goods.length < 2) {
      throw new Error('Not enough goods in database')
    }

    for (const product of products) {
      await product.related('goods').sync({
        [goods[0].id]: { quantity: 2 },
        [goods[1].id]: { quantity: 5 },
      })
    }
  }
}