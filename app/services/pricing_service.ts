import type Good from '#models/good'

export interface SupplierPrice {
  id: number
  name: string
  price: number
}

// The good MUST have been loaded with `preload('suppliers')`: the price lives on
// the pivot, in `$extras.pivot_price`. It is a `decimal(10,2)`, which `pg` hands
// back as a string — hence the coercion, and the rejection of non-numeric values.
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

export function bestSupplierPrice(good: Good): SupplierPrice | null {
  return supplierPrices(good)[0] ?? null
}

export function minSupplierPrice(good: Good): number | null {
  return bestSupplierPrice(good)?.price ?? null
}
