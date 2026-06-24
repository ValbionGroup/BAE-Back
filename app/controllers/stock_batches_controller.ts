import type { HttpContext } from '@adonisjs/core/http'
import StockBatch from '#models/stock_batch'

export default class StockBatchesController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    const stockBatches = await StockBatch.query().preload('good').preload('restock')
    return stockBatches
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {
    const { expirationDate, label, quantity, restockId, goodId } = request.all()
    const stockBatch = await StockBatch.create({
      expirationDate,
      label,
      quantity,
      restockId,
      goodId,
    })
    return stockBatch
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    const stockBatch = await StockBatch.query()
      .where('id', params.id)
      .preload('good')
      .preload('restock')
      .firstOrFail()
    return stockBatch
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const stockBatch = await StockBatch.query()
      .where('id', params.id)
      .preload('good')
      .preload('restock')
      .firstOrFail()
    const { expirationDate, label, quantity, restockId, goodId } = request.all()
    await stockBatch
      .merge({
        expirationDate,
        label,
        quantity,
        restockId,
        goodId,
      })
      .save()
    return stockBatch
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const stockBatch = await StockBatch.query()
      .where('id', params.id)
      .preload('good')
      .preload('restock')
      .firstOrFail()
    await stockBatch.delete()
  }
}
