import type Good from '#models/good'

/**
 * A single supplier's offer for a good, read from the `good_suppliers` pivot.
 *
 * `price` is a `decimal(10,2)` column, which `pg` hands back as a string. It is
 * coerced to a number here so consumers never do arithmetic on strings.
 */
export interface SupplierPrice {
  id: number
  name: string
  price: number
}

/**
 * Read every supplier price attached to a good, cheapest first.
 *
 * The good MUST have been loaded with `preload('suppliers')` so the pivot value
 * is available on `$extras.pivot_price`. Rows whose price is not a number
 * (NULL pivot, malformed value) are dropped rather than surfaced as NaN.
 */
export function supplierPrices(good: Good): SupplierPrice[] {
  return good.suppliers
    .map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      price: Number(supplier.$extras.pivot_price),
    }))
    .filter((entry) => !Number.isNaN(entry.price))
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
}

/**
 * The supplier offering the cheapest price for a good, or `null` when the good
 * has no priced supplier.
 */
export function bestSupplierPrice(good: Good): SupplierPrice | null {
  return supplierPrices(good)[0] ?? null
}

/**
 * The cheapest supplier price for a good, or `null` when no supplier offers it.
 *
 * Extracted from `ProductsController` so the goods listing and the recipe
 * costing agree on what "unit price" means.
 */
export function minSupplierPrice(good: Good): number | null {
  return bestSupplierPrice(good)?.price ?? null
}
