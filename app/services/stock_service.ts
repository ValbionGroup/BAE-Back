import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import StockBatch from '#models/stock_batch'
import StockMovement from '#models/stock_movement'

/**
 * A stock batch enriched with its server-computed remaining quantity.
 *
 * There is no stored remaining quantity: it is always derived as
 * `max(0, batch.quantity - sum(OUT movements on the batch))`. `quantity`
 * columns are varchar in the database, so every value is coerced with Number().
 */
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

/**
 * Load a good's batches with their computed remaining quantity, ordered FEFO
 * (expiration ascending; Postgres puts NULLs last for ASC). Empty batches are
 * excluded unless `showEmpty` is true.
 */
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

/**
 * Aggregate a good's per-batch remaining quantities into a stock summary.
 * Only non-empty batches (remaining > 0) count toward every metric.
 */
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

/**
 * Compute the remaining quantity of a single batch. Used by the discard flow so
 * the write-off quantity is derived server-side rather than trusted from the client.
 */
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
