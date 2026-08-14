import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Good from '#models/good'
import StockBatch from '#models/stock_batch'
import { StockMovementFactory } from '#database/factories/stock_movement_factory'

export default class extends BaseSeeder {
  async run() {
    const goods = await Good.query().select('id')
    const stockBatches = await StockBatch.query().select('id')

    if (goods.length === 0) {
      throw new Error('StockMovementSeeder: no goods found. Run GoodSeeder first.')
    }

    if (stockBatches.length === 0) {
      throw new Error('StockMovementSeeder: no stock batches found. Run StockBatchSeeder first.')
    }

    console.log(
      `Seeding stock movements with ${goods.length} goods and ${stockBatches.length} stock batches...`
    )

    const pickId = (rows: Array<{ id: number }>) => rows[Math.floor(Math.random() * rows.length)].id

    await StockMovementFactory.merge(
      Array.from({ length: 20 }, () => {
        const goodId = pickId(goods)

        let stockBatchId = pickId(stockBatches)
        if (stockBatches.length > 1) {
          while (stockBatchId === goodId) {
            stockBatchId = pickId(stockBatches)
          }
        }

        return {
          goodId,
          stockBatchId,
        }
      })
    ).createMany(20)
  }
}
