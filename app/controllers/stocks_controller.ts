import type { HttpContext } from '@adonisjs/core/http'
import Good from '#models/good'
import StockBatch from '#models/stock_batch'
import StockMovement from '#models/stock_movement'
import db from '@adonisjs/lucid/services/db'
import {
  loadBatchesWithRemaining,
  computeGoodStockSummary,
  remainingForBatch,
} from '#services/stock_service'

export default class StocksController {
  async index({ serialize }: HttpContext) {
    const goods = await Good.query().preload('category').orderBy('name')
    const summaries = await Promise.all(
      goods.map(async (good) => {
        const batches = await loadBatchesWithRemaining(good.id, true)
        return {
          id: good.id,
          name: good.name,
          unit: good.unit,
          brand: good.brand,
          categoryId: good.categoryId,
          category: good.category?.name ?? null,
          storageMethod: good.storageMethod,
          ...computeGoodStockSummary(batches),
        }
      })
    )
    return serialize(summaries)
  }

  async batches({ params, request, serialize }: HttpContext) {
    const showEmpty = request.qs().showEmpty === 'true' || request.qs().showEmpty === true
    const batches = await loadBatchesWithRemaining(params.id, showEmpty)
    return serialize(batches)
  }

  async discard({ params, response }: HttpContext) {
    await db.transaction(async (trx) => {
      const batch = await StockBatch.query({ client: trx })
        .where('id', params.batchId)
        .where('goodId', params.id)
        .firstOrFail()
      const remaining = await remainingForBatch(batch, trx)
      if (remaining > 0) {
        await StockMovement.create(
          {
            goodId: Number(params.id),
            stockBatchId: batch.id,
            quantity: String(remaining),
            movementType: 'out',
          },
          { client: trx }
        )
      }
    })
    return response.noContent()
  }
}
