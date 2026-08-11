import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Event from '#models/event'
import Good from '#models/good'
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

export interface ReturnableGood {
  goodId: number
  goodName: string
  unit: string
  takenQty: number
  returnedQty: number
  returnableQty: number
}

interface BatchTally {
  batchId: number
  taken: number
  returned: number
}

/**
 * What the evening took from each batch, and what it has already given back.
 *
 * The arrays come out newest-movement-first, which is the REVERSE of the order
 * the picks were written in — that is the order a return credits them back.
 * Shared by the listing and the write so the two can never disagree on what is
 * returnable.
 */
async function tallyByGood(
  eventId: number,
  trx: TransactionClientContract,
  goodId?: number
): Promise<Map<number, BatchTally[]>> {
  const runs = await ProductionRun.query({ client: trx }).where('eventId', eventId).select('id')
  const runIds = runs.map((run) => run.id)
  if (runIds.length === 0) return new Map()

  const query = StockMovement.query({ client: trx })
    .whereIn('productionRunId', runIds)
    .orderBy('id', 'desc')
  if (goodId !== undefined) query.where('goodId', goodId)

  const movements = await query

  const byGood = new Map<number, BatchTally[]>()
  for (const movement of movements) {
    const tallies = byGood.get(movement.goodId) ?? []
    if (!byGood.has(movement.goodId)) byGood.set(movement.goodId, tallies)

    let tally = tallies.find((entry) => entry.batchId === movement.stockBatchId)
    if (!tally) {
      tally = { batchId: movement.stockBatchId, taken: 0, returned: 0 }
      tallies.push(tally)
    }
    if (movement.movementType === 'out') tally.taken += Number(movement.quantity)
    else tally.returned += Number(movement.quantity)
  }

  return byGood
}

/**
 * Feeds the closing modal: per good, what the evening took, what already went
 * back, and what may still go back.
 *
 * Nothing else answers this. `GET production-runs` replies per RECIPE, and
 * `commitReturns` computes the returnable amount without exposing it — a screen
 * cannot build a form out of a 400's message.
 */
export async function loadReturnState(eventId: number): Promise<ReturnableGood[]> {
  return db.transaction(async (trx) => {
    const event = await Event.query({ client: trx }).where('id', eventId).first()
    if (!event) {
      throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
    }

    const byGood = await tallyByGood(eventId, trx)
    if (byGood.size === 0) return []

    const goods = await Good.query({ client: trx }).whereIn('id', [...byGood.keys()]).orderBy('name')

    return goods.map((good) => {
      const tallies = byGood.get(good.id) ?? []
      const takenQty = tallies.reduce((sum, tally) => sum + tally.taken, 0)
      const returnedQty = tallies.reduce((sum, tally) => sum + tally.returned, 0)
      return {
        goodId: good.id,
        goodName: good.name,
        unit: good.unit,
        takenQty,
        returnedQty,
        // Capped per batch, exactly as the write caps it: a batch that gave back
        // everything must not lend its slack to another.
        returnableQty: tallies.reduce(
          (sum, tally) => sum + Math.max(0, tally.taken - tally.returned),
          0
        ),
      }
    })
  })
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

      // The same tally the listing serves, so the form and the write can never
      // disagree on what is returnable. Newest movement first — the reverse of
      // the pick order.
      const tallies = (await tallyByGood(eventId, trx, line.goodId)).get(line.goodId) ?? []
      const takenByBatch = new Map(
        tallies.map((tally) => [tally.batchId, tally.taken - tally.returned])
      )
      const order = tallies.map((tally) => tally.batchId)

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
