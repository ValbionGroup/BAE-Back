import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DEMO_ONLY } from '#database/seeder_environment'
import { StockBatchFactory } from '#database/factories/stock_batch_factory'
import Good from '#models/good'
import Restock from '#models/restock'

export default class extends BaseSeeder {
  static environment = DEMO_ONLY

  async run() {
    const goods = await Good.query().select('id')
    const restocks = await Restock.query().select('id')

    if (goods.length === 0) {
      throw new Error('StockBatchSeeder: no goods found. Run GoodSeeder first.')
    }

    if (restocks.length === 0) {
      throw new Error('StockBatchSeeder: no restocks found. Run RestockSeeder first.')
    }

    await StockBatchFactory.merge(
      Array.from({ length: 10 }, (_, index) => ({
        goodId: goods[index % goods.length].id,
        restockId: restocks[index % restocks.length].id,
      }))
    ).createMany(10)
  }
}
