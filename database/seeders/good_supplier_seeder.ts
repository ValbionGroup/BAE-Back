import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Good from '#models/good'
import Supplier from '#models/supplier'

export default class extends BaseSeeder {
  async run() {
    // Write your database queries inside the run method
    const goods = await Good.all()
    const suppliers = await Supplier.all()

    console.log(`Found ${goods.length} goods and ${suppliers.length} suppliers`)

    if (goods.length < 2) {
      throw new Error('Not enough goods in database. Run good_seeder first!')
    }

    if (suppliers.length === 0) {
      throw new Error('Not enough suppliers in database. Run supplier_seeder first!')
    }

    // Pour chaque supplier, attacher plusieurs goods avec des quantités
    for (const supplier of suppliers) {
      // Sélectionner 2-3 goods aléatoires pour chaque supplier 
      const randomGoodsCount = Math.floor(Math.random() * 2) + 2 // 2 ou 3 goods
      const selectedGoods = goods
        .sort(() => 0.5 - Math.random()) // Mélanger
        .slice(0, randomGoodsCount)

      const pivotData: Record<number, { price: number }> = {}
      
      for (const good of selectedGoods) {
        pivotData[good.id] = {
          price: Math.floor(Math.random() * 1000) + 10 // prix entre 10 et 1000
        }
      }

      await supplier.related('goods').sync(pivotData)
    }
  }
}