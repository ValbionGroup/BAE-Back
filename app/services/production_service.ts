import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Event from '#models/event'
import Product from '#models/product'
import ProductionRun from '#models/production_run'
import StockBatch from '#models/stock_batch'
import StockMovement from '#models/stock_movement'
import ApiException from '#exceptions/api_exception'
import { loadBatchesWithRemaining, type BatchWithRemaining } from '#services/stock_service'

export interface PickLine {
  batchId: number
  label: string
  expirationDate: string | null
  takeQty: number
}

export interface GoodNeed {
  goodId: number
  goodName: string
  unit: string
  needQty: number
  availableQty: number
  picks: PickLine[]
}

export interface Shortfall {
  goodId: number
  goodName: string
  needQty: number
  availableQty: number
  missingQty: number
}

/**
 * Walks the batches in FEFO order and fills the need.
 *
 * Expired batches are EXCLUDED: FEFO exists to avoid waste, not to serve
 * out-of-date food. An expired batch leaves the stock through `discard`, which
 * already exists. A batch without a DLC comes last — `loadBatchesWithRemaining`
 * orders by expiration date ascending and Postgres sorts NULLS LAST.
 */
export function planPickForGood(
  batches: BatchWithRemaining[],
  needQty: number,
  now: DateTime
): { picks: { batchId: number; takeQty: number }[]; availableQty: number } {
  const usable = batches.filter(
    (batch) => batch.remainingQty > 0 && (!batch.expirationDate || batch.expirationDate >= now)
  )

  const picks: { batchId: number; takeQty: number }[] = []
  let left = needQty
  for (const batch of usable) {
    if (left <= 0) break
    const takeQty = Math.min(left, batch.remainingQty)
    picks.push({ batchId: batch.id, takeQty })
    left -= takeQty
  }

  return {
    picks,
    availableQty: usable.reduce((sum, batch) => sum + batch.remainingQty, 0),
  }
}

/**
 * Builds the pick plan for `quantity` units of a recipe. Writes nothing — the
 * caller decides whether to commit, and recomputes inside its own transaction.
 *
 * Only goods are planned. A recipe also carries `product_furnitures`, but
 * `furnitures` is a flat counter with no batches and no movement ledger:
 * decrementing it would be destructive and irreversible. See §8.2 of the spec.
 */
export async function planProduction(
  productId: number,
  quantity: number,
  trx?: TransactionClientContract
): Promise<{ lines: GoodNeed[]; shortfalls: Shortfall[] }> {
  const product = await Product.query({ client: trx })
    .where('id', productId)
    .preload('goods')
    .first()

  if (!product) {
    throw new ApiException('E_PRODUCT_NOT_FOUND', "Cette recette n'existe pas.", 404)
  }

  const now = DateTime.now()
  const lines: GoodNeed[] = []
  const shortfalls: Shortfall[] = []

  for (const good of product.goods) {
    // `product_goods.quantity` arrives through the pivot, hence $extras.
    const perUnit = Number(good.$extras.pivot_quantity)
    const needQty = perUnit * quantity
    const batches = await loadBatchesWithRemaining(good.id, false, trx)
    const { picks, availableQty } = planPickForGood(batches, needQty, now)

    const byId = new Map(batches.map((batch) => [batch.id, batch]))
    lines.push({
      goodId: good.id,
      goodName: good.name,
      unit: good.unit,
      needQty,
      availableQty,
      picks: picks.map((pick) => {
        const batch = byId.get(pick.batchId)!
        return {
          batchId: pick.batchId,
          // The label and the DLC travel with the plan because they are what one
          // reads in front of a shelf. A batch id alone helps nobody.
          label: batch.label,
          expirationDate: batch.expirationDate?.toISO() ?? null,
          takeQty: pick.takeQty,
        }
      }),
    })

    if (availableQty < needQty) {
      shortfalls.push({
        goodId: good.id,
        goodName: good.name,
        needQty,
        availableQty,
        missingQty: needQty - availableQty,
      })
    }
  }

  return { lines, shortfalls }
}

/**
 * Commits a production run inside one transaction.
 *
 * The plan is RECOMPUTED here and never trusted from the caller: a dry run seen
 * on screen is information for a human, not an order to replay. Between the two
 * calls someone else may have taken the same batch.
 */
export async function commitProduction(
  eventId: number,
  productId: number,
  quantity: number,
  memberId: number | null
): Promise<{ run: ProductionRun; lines: GoodNeed[] }> {
  return db.transaction(async (trx) => {
    const event = await Event.query({ client: trx }).where('id', eventId).first()
    if (!event) {
      throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
    }

    const product = await Product.query({ client: trx })
      .where('id', productId)
      .preload('goods')
      .first()
    if (!product) {
      throw new ApiException('E_PRODUCT_NOT_FOUND', "Cette recette n'existe pas.", 404)
    }

    // Lock every batch of every good this recipe touches, ORDERED BY id.
    // Without the lock, two simultaneous runs read the same remaining quantity
    // and empty the same batch twice. Without the ordering, two runs touching
    // the same batches in a different order deadlock each other.
    const goodIds = product.goods.map((good) => good.id)
    if (goodIds.length > 0) {
      await StockBatch.query({ client: trx })
        .whereIn('goodId', goodIds)
        .orderBy('id', 'asc')
        .forUpdate()
    }

    const { lines, shortfalls } = await planProduction(productId, quantity, trx)

    if (shortfalls.length > 0) {
      const detail = shortfalls.map((s) => `${s.goodName} (manque ${s.missingQty})`).join(', ')
      throw new ApiException(
        'E_STOCK_INSUFFICIENT',
        `Le stock ne couvre pas cette production : ${detail}.`,
        409
      )
    }

    const run = new ProductionRun()
    run.useTransaction(trx)
    run.eventId = eventId
    run.productId = productId
    run.quantity = quantity
    run.memberId = memberId
    await run.save()

    for (const line of lines) {
      for (const pick of line.picks) {
        await StockMovement.create(
          {
            goodId: line.goodId,
            stockBatchId: pick.batchId,
            quantity: String(pick.takeQty),
            movementType: 'out',
            productionRunId: run.id,
          },
          { client: trx }
        )
      }
    }

    return { run, lines }
  })
}
