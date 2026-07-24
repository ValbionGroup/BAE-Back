import type { HttpContext } from '@adonisjs/core/http'
import StockBatch from '#models/stock_batch'

export default class StockBatchesController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    const stockBatches = await StockBatch.query().preload('good').preload('restock')
    return serialize(stockBatches)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { expirationDate, label, quantity, restockId, goodId } = request.all()
    const stockBatch = await StockBatch.create({
      expirationDate,
      label,
      quantity,
      restockId,
      goodId,
    })
    return serialize(stockBatch)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    const stockBatch = await StockBatch.query()
      .where('id', params.id)
      .preload('good')
      .preload('restock')
      .firstOrFail()
    return serialize(stockBatch)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
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
    return serialize(stockBatch)
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
