import type Product from '#models/product'

// `products` has no category column: a recipe is labelled with the category of
// its lowest-`rank` ingredient. The product must have been loaded with
// `preload('goods', (g) => g.preload('category'))`, otherwise everything comes
// back `null`. Breaking ties by name keeps the value deterministic: two
// ingredients can share a rank, and an unstable sort would change a recipe's
// category from one request to the next.
export function primaryCategoryName(product: Product): string | null {
  const [primary] = [...product.goods].sort(
    (a, b) =>
      Number(a.$extras.pivot_rank ?? 0) - Number(b.$extras.pivot_rank ?? 0) ||
      a.name.localeCompare(b.name)
  )
  return primary?.category?.name ?? null
}
