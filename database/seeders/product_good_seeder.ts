import Good from '#models/good'
import Product from '#models/product'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    const goods = await Good.all()
    const products = await Product.all()

    console.log(`Found ${goods.length} goods and ${products.length} products`)

    if (goods.length < 2) {
      throw new Error('Not enough goods in database. Run good_seeder first!')
    }

    if (products.length === 0) {
      throw new Error('Not enough products in database. Run product_seeder first!')
    }

    // Pour chaque product, attacher plusieurs goods avec des quantités
    for (const product of products) {
      // Sélectionner 2-3 goods aléatoires pour chaque product
      const randomGoodsCount = Math.floor(Math.random() * 2) + 2 // 2 ou 3 goods
      const selectedGoods = goods
        .sort(() => 0.5 - Math.random()) // Mélanger
        .slice(0, randomGoodsCount)

      const pivotData: Record<number, { quantity: number }> = {}
      
      for (const good of selectedGoods) {
        pivotData[good.id] = {
          quantity: Math.floor(Math.random() * 10) + 1 // quantité entre 1 et 10
        }
      }

      await product.related('goods').sync(pivotData)
    }
  }
}