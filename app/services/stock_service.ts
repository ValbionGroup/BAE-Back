import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import StockBatch from '#models/stock_batch'
import StockMovement from '#models/stock_movement'

export interface BatchWithRemaining {
  id: number
  goodId: number | null
  restockId: number | null
  /** The human-readable lot number (`L26-4`), what one reads on the shelf. */
  label: string
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
// `max(0, batch quantity − OUT movements + IN movements)`. The `quantity` columns
// are varchar in the database, hence the systematic coercion through `Number()`.
//
// An IN movement means one thing and one thing only: a production return. Stock
// ENTERS through the stock_batches row itself (its `quantity`), never through a
// movement — so nothing else may write one.
//
// Batches come back ordered by expiration date ascending, which Postgres sorts
// NULLS LAST. That ordering IS the FEFO order the production service walks.
export async function loadBatchesWithRemaining(
  goodId: number | string,
  showEmpty = false,
  trx?: TransactionClientContract
): Promise<BatchWithRemaining[]> {
  const batches = await StockBatch.query({ client: trx })
    .where('goodId', goodId)
    .preload('movement')
    .orderBy('expirationDate', 'asc')

  return batches
    .map((batch) => {
      const outMovements = batch.movement.filter((m) => m.movementType === 'out')
      const outQty = outMovements.reduce((sum, m) => sum + Number(m.quantity), 0)
      const inQty = batch.movement
        .filter((m) => m.movementType === 'in')
        .reduce((sum, m) => sum + Number(m.quantity), 0)
      const initialQty = Number(batch.quantity)
      // Only OUT movements open a packet — a return does not un-open it.
      const openedAt = outMovements.reduce<DateTime | null>((min, m) => {
        if (!m.createdAt) return min
        return !min || m.createdAt < min ? m.createdAt : min
      }, null)

      return {
        id: batch.id,
        goodId: batch.goodId,
        restockId: batch.restockId,
        label: batch.label,
        initialQty,
        remainingQty: Math.max(0, initialQty - outQty + inQty),
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
  const movements = await StockMovement.query({ client: trx }).where('stockBatchId', batch.id)

  const outQty = movements
    .filter((m) => m.movementType === 'out')
    .reduce((sum, m) => sum + Number(m.quantity), 0)
  const inQty = movements
    .filter((m) => m.movementType === 'in')
    .reduce((sum, m) => sum + Number(m.quantity), 0)

  return Math.max(0, Number(batch.quantity) - outQty + inQty)
}
