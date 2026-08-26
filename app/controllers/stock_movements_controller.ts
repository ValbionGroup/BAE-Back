import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import StockBatch from '#models/stock_batch'
import StockMovement from '#models/stock_movement'
import ApiException from '#exceptions/api_exception'
import { remainingForBatch } from '#services/stock_service'
import { stockMovementValidator, stockMovementUpdateValidator } from '#validators/stock'

/**
 * Le lot visé, une fois vérifié qu'il appartient bien à la denrée annoncée.
 *
 * ⚠️ Sans ce contrôle, un mouvement s'écrivait sur le lot demandé tout en étant
 * compté dans le total de `goodId` : deux denrées fausses d'un coup, et rien
 * dans l'écran pour le voir.
 */
async function batchOf(
  goodId: number,
  stockBatchId: number,
  trx: TransactionClientContract
): Promise<StockBatch> {
  const batch = await StockBatch.query({ client: trx }).where('id', stockBatchId).firstOrFail()
  if (batch.goodId !== goodId) {
    throw new ApiException('E_BATCH_MISMATCH', "Ce lot n'appartient pas à cette denrée.", 422)
  }
  return batch
}

/** Une entrée n'a rien à vérifier contre le restant : elle l'augmente. */
async function assertFits(
  batch: StockBatch,
  movementType: 'in' | 'out',
  quantity: number,
  trx: TransactionClientContract,
  excludeMovementId?: number
): Promise<void> {
  if (movementType !== 'out') return
  const remaining = await remainingForBatch(batch, trx, excludeMovementId)
  if (quantity > remaining) {
    throw new ApiException(
      'E_STOCK_INSUFFICIENT',
      `Ce lot ne porte plus que ${remaining} unité(s).`,
      422
    )
  }
}

export default class StockMovementsController {
  async index({ serialize }: HttpContext) {
    const stockMovements = await StockMovement.query().preload('good').preload('stockBatch')
    return serialize(stockMovements)
  }

  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(stockMovementValidator)

    const stockMovement = await db.transaction(async (trx) => {
      const batch = await batchOf(payload.goodId, payload.stockBatchId, trx)
      await assertFits(batch, payload.movementType, payload.quantity, trx)

      // `quantity` est une colonne `decimal` : le driver la rend en string, on
      // la lui donne en string — c'est ce que fait déjà `StocksController.discard`.
      return StockMovement.create(
        {
          goodId: payload.goodId,
          stockBatchId: payload.stockBatchId,
          quantity: String(payload.quantity),
          movementType: payload.movementType,
        },
        { client: trx }
      )
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
    const payload = await request.validateUsing(stockMovementUpdateValidator)

    const stockMovement = await db.transaction(async (trx) => {
      const movement = await StockMovement.query({ client: trx })
        .where('id', params.id)
        .firstOrFail()

      // Ce que le mouvement vaudra une fois corrigé : les clés absentes gardent
      // la valeur en place, donc les gardes portent sur l'état final, pas sur
      // le fragment envoyé.
      const goodId = payload.goodId ?? movement.goodId
      const stockBatchId = payload.stockBatchId ?? movement.stockBatchId
      const quantity = payload.quantity ?? Number(movement.quantity)
      const movementType = payload.movementType ?? (movement.movementType as 'in' | 'out')

      const batch = await batchOf(goodId, stockBatchId, trx)
      await assertFits(batch, movementType, quantity, trx, movement.id)

      await movement
        .merge({ goodId, stockBatchId, quantity: String(quantity), movementType })
        .save()
      return movement
    })

    await stockMovement.load('good')
    await stockMovement.load('stockBatch')
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
