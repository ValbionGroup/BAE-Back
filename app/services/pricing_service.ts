import type Good from '#models/good'

export interface SupplierPrice {
  id: number
  name: string
  price: number
}

// Le bien DOIT avoir été chargé avec `preload('suppliers')` : le prix vit sur le
// pivot, dans `$extras.pivot_price`. C'est un `integer` de **centimes**.
//
// La coercion `Number()` d'avant existait parce que la colonne était un
// `decimal(10,2)`, que `pg` rendait en string. C'est ici, et nulle part
// ailleurs, que les valeurs dérivées (`unitCost`, `totalCost`, `cost`, les
// totaux de la liste de courses) changent d'unité — aucune d'elles n'est
// modifiée, ce qui rend le basculement invisible au compilateur.
export function supplierPrices(good: Good): SupplierPrice[] {
  return good.suppliers
    .map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      price: supplier.$extras.pivot_price as number,
    }))
    .filter((entry) => Number.isFinite(entry.price))
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
}

export function bestSupplierPrice(good: Good): SupplierPrice | null {
  return supplierPrices(good)[0] ?? null
}

export function minSupplierPrice(good: Good): number | null {
  return bestSupplierPrice(good)?.price ?? null
}
