import type { HttpContext } from '@adonisjs/core/http'
import StockMovement from '#models/stock_movement'

export default class StockMovementsController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    const stockMovements = await StockMovement.query().preload('good').preload('stockBatch')
    return stockMovements
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {
    const { quantity, movementType, goodId, stockBatchId } = request.all()
    const stockMovement = await StockMovement.create({
      quantity,
      movementType,
      goodId,
      stockBatchId,
    })
    return stockMovement
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    const stockMovement = await StockMovement.query()
      .where('id', params.id)
      .preload('good')
      .preload('stockBatch')
      .firstOrFail()

    return stockMovement
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const stockMovement = await StockMovement.query().where('id', params.id).preload('good').preload('stockBatch').firstOrFail()
    const { quantity, movementType, goodId, stockBatchId } = request.all()

    stockMovement.quantity = quantity
    stockMovement.movementType = movementType
    stockMovement.goodId = goodId
    stockMovement.stockBatchId = stockBatchId

    await stockMovement.save()
    return stockMovement
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const stockMovement = await StockMovement.query().where('id', params.id).preload('good').preload('stockBatch').firstOrFail()
    await stockMovement.delete()
  }
}