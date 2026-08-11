import type { HttpContext } from '@adonisjs/core/http'
import StockMovement from '#models/stock_movement'

export default class StockMovementsController {
  async index({ serialize }: HttpContext) {
    const stockMovements = await StockMovement.query().preload('good').preload('stockBatch')
    return serialize(stockMovements)
  }

  async store({ request, serialize }: HttpContext) {
    const { quantity, movementType, goodId, stockBatchId } = request.all()
    const stockMovement = await StockMovement.create({
      quantity,
      movementType,
      goodId,
      stockBatchId,
    })
    return serialize(stockMovement)
  }

  async show({ params, serialize }: HttpContext) {
    const stockMovement = await StockMovement.query()
      .where('id', params.id)
      .preload('good')
      .preload('stockBatch')
      .firstOrFail()

    return serialize(stockMovement)
  }

  async update({ params, request, serialize }: HttpContext) {
    const stockMovement = await StockMovement.query()
      .where('id', params.id)
      .preload('good')
      .preload('stockBatch')
      .firstOrFail()
    const { quantity, movementType, goodId, stockBatchId } = request.all()

    stockMovement.quantity = quantity
    stockMovement.movementType = movementType
    stockMovement.goodId = goodId
    stockMovement.stockBatchId = stockBatchId

    await stockMovement.save()
    return serialize(stockMovement)
  }

  async destroy({ params }: HttpContext) {
    const stockMovement = await StockMovement.query()
      .where('id', params.id)
      .preload('good')
      .preload('stockBatch')
      .firstOrFail()
    await stockMovement.delete()
  }
}
