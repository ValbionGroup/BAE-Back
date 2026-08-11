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

export interface ReturnCredit {
  batchId: number
  label: string
  qty: number
}

/**
 * Puts back what did not get used, at the scale of the EVENING and not of one
 * run: an operator counts what is left on the bench, not run by run.
 *
 * Credits travel in reverse order of the pick — last taken, first given back.
 * The short-DLC batches were opened and started first, so what comes back is
 * what was not touched. The per-batch cap is what keeps `remainingQty` from ever
 * exceeding the batch's initial quantity.
 *
 * Discarding writes NOTHING: the stock left at the run, throwing away is simply
 * not crediting it back. The waste is therefore not counted, but it is not lost
 * either — `Σ out − Σ in` is what did not come back, and once `orders` exists,
 * `production_runs.quantity − Σ order_products` is the real figure.
 */
export async function commitReturns(
  eventId: number,
  lines: { goodId: number; quantity: number }[]
): Promise<{ goodId: number; credits: ReturnCredit[] }[]> {
  return db.transaction(async (trx) => {
    const event = await Event.query({ client: trx }).where('id', eventId).first()
    if (!event) {
      throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
    }

    const runs = await ProductionRun.query({ client: trx }).where('eventId', eventId).select('id')
    const runIds = runs.map((run) => run.id)

    const result: { goodId: number; credits: ReturnCredit[] }[] = []

    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new ApiException(
          'E_BAD_REQUEST',
          'Une quantité de retour doit être un entier supérieur à zéro.',
          400
        )
      }

      // Ordered by id descending: the newest movement first, which is the
      // reverse of the order the picks were written in.
      const movements =
        runIds.length === 0
          ? []
          : await StockMovement.query({ client: trx })
              .whereIn('productionRunId', runIds)
              .where('goodId', line.goodId)
              .orderBy('id', 'desc')

      // Per batch: what the evening took, minus what it has already given back.
      const takenByBatch = new Map<number, number>()
      const order: number[] = []
      for (const movement of movements) {
        const batchId = movement.stockBatchId
        if (!takenByBatch.has(batchId)) {
          takenByBatch.set(batchId, 0)
          order.push(batchId)
        }
        const signed = movement.movementType === 'out' ? 1 : -1
        takenByBatch.set(batchId, takenByBatch.get(batchId)! + signed * Number(movement.quantity))
      }

      const returnable = [...takenByBatch.values()].reduce((sum, qty) => sum + Math.max(0, qty), 0)
      if (line.quantity > returnable) {
        throw new ApiException(
          'E_RETURN_EXCEEDS_PICKED',
          `On ne peut pas remettre en stock plus que ce que la soirée a prélevé (${returnable}).`,
          400
        )
      }

      const batches = await StockBatch.query({ client: trx }).whereIn('id', order)
      const labelById = new Map(batches.map((batch) => [batch.id, batch.label]))

      const credits: ReturnCredit[] = []
      let left = line.quantity
      for (const batchId of order) {
        if (left <= 0) break
        const room = Math.max(0, takenByBatch.get(batchId)!)
        if (room === 0) continue
        const qty = Math.min(left, room)
        await StockMovement.create(
          {
            goodId: line.goodId,
            stockBatchId: batchId,
            quantity: String(qty),
            movementType: 'in',
            productionRunId: runIds[runIds.length - 1] ?? null,
          },
          { client: trx }
        )
        credits.push({ batchId, label: labelById.get(batchId) ?? '—', qty })
        left -= qty
      }

      result.push({ goodId: line.goodId, credits })
    }

    return result
  })
}
