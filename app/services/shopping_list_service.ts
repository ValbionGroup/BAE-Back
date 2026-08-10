import Event from '#models/event'
import ApiException from '#exceptions/api_exception'
import { loadBatchesWithRemaining } from '#services/stock_service'
import { bestSupplierPrice, supplierPrices, type SupplierPrice } from '#services/pricing_service'

/**
 * Une ligne de la liste de courses : une denrée ou un article non alimentaire
 * qu'il faut acheter, et de combien.
 *
 * `kind` n'est pas décoratif. Le stock d'une **denrée** se dérive de ses lots
 * moins les mouvements sortants ; celui d'un **non-alimentaire** est stocké sur
 * sa propre ligne (`furnitures.quantity`). Et `furnitures` n'a aucune relation
 * fournisseur : `suppliers` est donc toujours vide pour ce genre, et `bestPrice`
 * porte son prix propre. Le comparatif d'enseignes ne s'applique qu'aux denrées.
 */
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

/**
 * Ce que coûterait la liste si on achetait tout chez cette enseigne.
 *
 * `fullCoverage` est indispensable, pas informatif : sans lui, une enseigne qui
 * ne référence que trois denrées sur douze affiche le total le plus bas de la
 * table **parce qu'elle en compte moins**, et le comparatif dit exactement le
 * contraire de la vérité.
 */
export interface SupplierTotal {
  id: number
  name: string
  total: number
  /** Vrai quand l'enseigne price chacune des lignes à acheter. */
  fullCoverage: boolean
}

export interface ShoppingList {
  eventId: number
  eventName: string
  /** Lignes à acheter, manque décroissant puis nom. Les lignes couvertes par le stock sont absentes. */
  lines: ShoppingListLine[]
  lineCount: number
  /** Somme du manque au meilleur prix, ligne par ligne. Les lignes sans prix connu valent 0. */
  optimumTotal: number
  supplierTotals: SupplierTotal[]
  /** Meilleure enseigne à couverture complète − optimum. `null` si aucune ne couvre tout. */
  savings: number | null
  /** Lignes à acheter dont on ignore le prix. À annoncer, jamais à compter comme gratuites. */
  unpricedCount: number
}

/** Accumulateur interne : le besoin agrégé par denrée ou par article. */
interface NeedAccumulator {
  needQty: number
}

/**
 * Calcule la liste de courses d'une soirée.
 *
 * ```
 * besoin(x)  = Σ ligneDeMenu.quantity × pivot.quantity   (sur tout le menu)
 * stock(x)   = lots restants (denrée)  |  furnitures.quantity (non-alimentaire)
 * manque(x)  = max(0, besoin(x) − stock(x))
 * ```
 *
 * Le besoin est agrégé **par denrée avant** qu'on retranche le stock. C'est ce
 * qui rend le calcul juste quand deux recettes du menu partagent un ingrédient,
 * et c'est aussi pourquoi il n'existe pas de manque « par recette » : on ne
 * saurait pas à laquelle attribuer le stock disponible.
 *
 * Vit côté back parce qu'il aura trois consommateurs — la liste de courses, le
 * coût d'une soirée et le bilan. Recalculé par écran, il donnerait trois
 * vérités divergentes.
 */
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
  const furnituresById = new Map<
    number,
    (typeof event.products)[number]['furnitures'][number]
  >()

  for (const product of event.products) {
    const produced = Number(product.$extras.pivot_quantity)

    for (const good of product.goods) {
      const perUnit = Number(good.$extras.pivot_quantity)
      const entry = goodNeeds.get(good.id) ?? { needQty: 0 }
      entry.needQty += produced * perUnit
      goodNeeds.set(good.id, entry)
      // La première occurrence suffit : `preload` rend le même jeu de
      // fournisseurs et de catégorie pour une denrée donnée.
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
    // Le stock est sur la ligne, pas dans des lots : le non-alimentaire n'est
    // pas suivi par DLC.
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

  // Les totaux par enseigne ne concernent que les denrées : le non-alimentaire
  // n'a pas de fournisseur, donc l'inclure fausserait la couverture.
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

  // `optimumTotal` (affiché comme « coût estimé ») porte le panier complet,
  // denrées + non-alimentaire : c'est le vrai coût de la soirée. Mais
  // `savings` compare des enseignes, et une enseigne ne vend que des denrées
  // — comparer contre le panier complet retrancherait le coût des barquettes
  // d'une économie qui ne parle que du pain et des saucisses. On recalcule
  // donc un optimum denrées-seules, purement local à cette comparaison.
  const optimumGoodsTotal = goodLines.reduce(
    (sum, line) => sum + (line.bestPrice === null ? 0 : line.missingQty * line.bestPrice),
    0
  )

  return {
    eventId: event.id,
    eventName: event.name,
    lines,
    lineCount: lines.length,
    optimumTotal,
    supplierTotals,
    savings: cheapestSingle === null ? null : cheapestSingle - optimumGoodsTotal,
    unpricedCount,
  }
}
