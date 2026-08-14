import Event from '#models/event'
import ApiException from '#exceptions/api_exception'
import { loadBatchesWithRemaining } from '#services/stock_service'
import { bestSupplierPrice, supplierPrices, type SupplierPrice } from '#services/pricing_service'

export interface ShoppingListLine {
  kind: 'good' | 'furniture'
  id: number
  name: string
  unit: string | null
  brand: string | null
  categoryName: string | null
  needQty: number
  stockQty: number
  missingQty: number
  suppliers: SupplierPrice[]
  bestSupplier: SupplierPrice | null
  bestPrice: number | null
}

export interface SupplierTotal {
  id: number
  name: string
  total: number
  // Without this flag, a retailer stocking only 3 goods out of 12 shows the
  // lowest total *because* it counts fewer of them, and the comparison says the
  // exact opposite of the truth.
  fullCoverage: boolean
}

export interface ShoppingTotals {
  optimumGoodsTotal: number
  furnitureTotal: number
}

export interface ShoppingList {
  eventId: number
  eventName: string
  lines: ShoppingListLine[]
  lineCount: number
  optimumTotal: number
  totals: ShoppingTotals
  supplierTotals: SupplierTotal[]
  savings: number | null
  unpricedCount: number
}

interface NeedAccumulator {
  needQty: number
}

export async function buildShoppingList(eventId: string): Promise<ShoppingList> {
  const event = await Event.query()
    .where('id', eventId)
    .preload('products', (products) => {
      products.preload('goods', (goods) => {
        goods.preload('suppliers')
        goods.preload('category')
      })
      products.preload('furnitures')
    })
    .first()

  if (!event) {
    throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
  }

  const goodNeeds = new Map<number, NeedAccumulator>()
  const furnitureNeeds = new Map<number, NeedAccumulator>()
  const goodsById = new Map<number, (typeof event.products)[number]['goods'][number]>()
  const furnituresById = new Map<number, (typeof event.products)[number]['furnitures'][number]>()

  // The need is aggregated per good BEFORE the stock is subtracted: that is what
  // makes the computation right when two recipes share an ingredient, and why
  // there can be no "per recipe" shortfall.
  for (const product of event.products) {
    const produced = Number(product.$extras.pivot_quantity)

    for (const good of product.goods) {
      const perUnit = Number(good.$extras.pivot_quantity)
      const entry = goodNeeds.get(good.id) ?? { needQty: 0 }
      entry.needQty += produced * perUnit
      goodNeeds.set(good.id, entry)
      if (!goodsById.has(good.id)) goodsById.set(good.id, good)
    }

    for (const furniture of product.furnitures) {
      const perUnit = Number(furniture.$extras.pivot_quantity)
      const entry = furnitureNeeds.get(furniture.id) ?? { needQty: 0 }
      entry.needQty += produced * perUnit
      furnitureNeeds.set(furniture.id, entry)
      if (!furnituresById.has(furniture.id)) furnituresById.set(furniture.id, furniture)
    }
  }

  const lines: ShoppingListLine[] = []

  for (const [goodId, { needQty }] of goodNeeds) {
    const good = goodsById.get(goodId)!
    const batches = await loadBatchesWithRemaining(goodId)
    const stockQty = batches.reduce((sum, batch) => sum + batch.remainingQty, 0)
    const missingQty = Math.max(0, needQty - stockQty)
    if (missingQty === 0) continue

    const best = bestSupplierPrice(good)
    lines.push({
      kind: 'good',
      id: good.id,
      name: good.name,
      unit: good.unit,
      brand: good.brand,
      categoryName: good.category?.name ?? null,
      needQty,
      stockQty,
      missingQty,
      suppliers: supplierPrices(good),
      bestSupplier: best,
      bestPrice: best?.price ?? null,
    })
  }

  for (const [furnitureId, { needQty }] of furnitureNeeds) {
    const furniture = furnituresById.get(furnitureId)!
    const stockQty = Number(furniture.quantity)
    const missingQty = Math.max(0, needQty - stockQty)
    if (missingQty === 0) continue

    const ownPrice = Number(furniture.price)
    lines.push({
      kind: 'furniture',
      id: furniture.id,
      name: furniture.name,
      unit: null,
      brand: null,
      categoryName: null,
      needQty,
      stockQty,
      missingQty,
      suppliers: [],
      bestSupplier: null,
      bestPrice: Number.isNaN(ownPrice) ? null : ownPrice,
    })
  }

  lines.sort((a, b) => b.missingQty - a.missingQty || a.name.localeCompare(b.name, 'fr'))

  const optimumTotal = lines.reduce(
    (sum, line) => sum + (line.bestPrice === null ? 0 : line.missingQty * line.bestPrice),
    0
  )
  const unpricedCount = lines.filter((line) => line.bestPrice === null).length

  const goodLines = lines.filter((line) => line.kind === 'good')
  const supplierIds = new Map<number, string>()
  for (const line of goodLines) {
    for (const supplier of line.suppliers) supplierIds.set(supplier.id, supplier.name)
  }

  const supplierTotals: SupplierTotal[] = [...supplierIds.entries()].map(([id, name]) => {
    let total = 0
    let covered = 0
    for (const line of goodLines) {
      const offer = line.suppliers.find((supplier) => supplier.id === id)
      if (!offer) continue
      total += line.missingQty * offer.price
      covered += 1
    }
    return { id, name, total, fullCoverage: covered === goodLines.length }
  })

  supplierTotals.sort((a, b) => a.total - b.total || a.name.localeCompare(b.name, 'fr'))

  const complete = supplierTotals.filter((entry) => entry.fullCoverage)
  const cheapestSingle = complete.length > 0 ? Math.min(...complete.map((e) => e.total)) : null

  const furnitureLines = lines.filter((line) => line.kind === 'furniture')

  const optimumGoodsTotal = goodLines.reduce(
    (sum, line) => sum + (line.bestPrice === null ? 0 : line.missingQty * line.bestPrice),
    0
  )
  const furnitureTotal = furnitureLines.reduce(
    (sum, line) => sum + (line.bestPrice === null ? 0 : line.missingQty * line.bestPrice),
    0
  )

  return {
    eventId: event.id,
    eventName: event.name,
    lines,
    lineCount: lines.length,
    optimumTotal,
    totals: {
      optimumGoodsTotal,
      furnitureTotal,
    },
    supplierTotals,
    savings: cheapestSingle === null ? null : cheapestSingle - optimumGoodsTotal,
    unpricedCount,
  }
}
