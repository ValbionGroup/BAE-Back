import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Product from '#models/product'
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
