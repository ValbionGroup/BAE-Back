import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import StockBatch from '#models/stock_batch'
import StockMovement from '#models/stock_movement'

export interface BatchWithRemaining {
  id: number
  goodId: number | null
  restockId: number | null
  initialQty: number
  remainingQty: number
  expirationDate: DateTime | null
  openedAt: DateTime | null
}

export interface GoodStockSummary {
  totalRemainingQty: number
  batchCount: number
  nearestExpirationDate: DateTime | null
  expiredBatchCount: number
  soonBatchCount: number
}

// The remaining quantity is never stored: it is always derived as
// `max(0, batch quantity − OUT movements)`. The `quantity` columns are varchar in
// the database, hence the systematic coercion through `Number()`.
export async function loadBatchesWithRemaining(
  goodId: number | string,
  showEmpty = false,
  trx?: TransactionClientContract
): Promise<BatchWithRemaining[]> {
  const batches = await StockBatch.query({ client: trx })
    .where('goodId', goodId)
    .preload('movement', (q) => q.where('movementType', 'out'))
    .orderBy('expirationDate', 'asc')

  return batches
    .map((batch) => {
      const outMovements = batch.movement
      const outQty = outMovements.reduce((sum, m) => sum + Number(m.quantity), 0)
      const initialQty = Number(batch.quantity)
      const openedAt = outMovements.reduce<DateTime | null>((min, m) => {
        if (!m.createdAt) return min
        return !min || m.createdAt < min ? m.createdAt : min
      }, null)

      return {
        id: batch.id,
        goodId: batch.goodId,
        restockId: batch.restockId,
        initialQty,
        remainingQty: Math.max(0, initialQty - outQty),
        expirationDate: batch.expirationDate,
        openedAt,
      }
    })
    .filter((batch) => showEmpty || batch.remainingQty > 0)
}

export function computeGoodStockSummary(batches: BatchWithRemaining[]): GoodStockSummary {
  const now = DateTime.now()
  const soonThreshold = now.plus({ days: 7 })
  const nonEmpty = batches.filter((batch) => batch.remainingQty > 0)

  let nearestExpirationDate: DateTime | null = null
  let expiredBatchCount = 0
  let soonBatchCount = 0

  for (const batch of nonEmpty) {
    if (!batch.expirationDate) continue
    if (!nearestExpirationDate || batch.expirationDate < nearestExpirationDate) {
      nearestExpirationDate = batch.expirationDate
    }
    if (batch.expirationDate < now) {
      expiredBatchCount++
    } else if (batch.expirationDate < soonThreshold) {
      soonBatchCount++
    }
  }

  return {
    totalRemainingQty: nonEmpty.reduce((sum, batch) => sum + batch.remainingQty, 0),
    batchCount: nonEmpty.length,
    nearestExpirationDate,
    expiredBatchCount,
    soonBatchCount,
  }
}

export async function remainingForBatch(
  batch: StockBatch,
  trx?: TransactionClientContract
): Promise<number> {
  const movements = await StockMovement.query({ client: trx })
    .where('stockBatchId', batch.id)
    .where('movementType', 'out')

  const outQty = movements.reduce((sum, m) => sum + Number(m.quantity), 0)
  return Math.max(0, Number(batch.quantity) - outQty)
}
