import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import type Product from '#models/product'
import ApiException from '#exceptions/api_exception'
import { minSupplierPrice } from '#services/pricing_service'

/**
 * Une ligne du menu d'une soirée, c'est-à-dire une ligne du pivot
 * `event_products`.
 *
 * `quantity` est la **quantité de production** décidée par la logistique.
 * `price` est le prix de **vente** de l'article ce soir-là — pas son coût :
 * aucun écran ne l'édite encore, ce contrôleur ne fait que le reporter (le lot
 * caisse en sera le consommateur).
 *
 * `unitCost` est le coût des denrées d'une pièce, dérivé de
 * `product_goods.quantity × minSupplierPrice(good)`. Il vaut `null` — et non 0 —
 * dès qu'une denrée de la recette n'a aucun fournisseur : un coût partiel serait
 * plus trompeur qu'un coût absent.
 */
interface MenuLinePayload {
  productId: number
  name: string
  isVegetarian: boolean
  quantity: number
  price: number
  unitCost: number | null
  totalCost: number | null
}

/**
 * Coût des denrées d'une pièce de cette recette.
 *
 * Le produit doit avoir été chargé avec `preload('goods', q => q.preload('suppliers'))` :
 * `minSupplierPrice` lit le pivot `good_suppliers.price` via
 * `$extras.pivot_price`, et `product_goods.quantity` via `$extras.pivot_quantity`.
 *
 * Même définition du « prix unitaire » que `ProductsController.summary` — c'est
 * la raison d'être de `pricing_service`, et il ne doit y en avoir qu'une.
 */
function unitCostOf(product: Product): number | null {
  let cost = 0
  for (const good of product.goods) {
    const price = minSupplierPrice(good)
    if (price === null) return null
    cost += Number(good.$extras.pivot_quantity) * price
  }
  return cost
}

function toMenuLine(product: Product): MenuLinePayload {
  const quantity = Number(product.$extras.pivot_quantity)
  const unitCost = unitCostOf(product)
  return {
    productId: product.id,
    name: product.name,
    // `is_vegetarian` n'est pas `notNullable()` en migration (seulement
    // `defaultTo(false)`) : Lucid type donc la colonne `boolean | null`, comme
    // `ProductsController` le traite déjà en écriture (`payload.isVegetarian ?? false`).
    isVegetarian: product.isVegetarian ?? false,
    quantity,
    price: Number(product.$extras.pivot_price),
    unitCost,
    totalCost: unitCost === null ? null : unitCost * quantity,
  }
}

/**
 * Charge une soirée avec son menu complet — recettes, denrées, fournisseurs.
 *
 * Un 404 explicite plutôt que `firstOrFail()` : le contrat de l'API porte le
 * code, et `ApiException` est la seule exception que le gestionnaire d'erreurs
 * traite spécialement (une exception nue devient `E_INTERNAL_SERVER_ERROR`).
 */
async function loadEventWithMenu(id: string): Promise<Event> {
  const event = await Event.query()
    .where('id', id)
    .preload('products', (products) => {
      products.preload('goods', (goods) => goods.preload('suppliers'))
      products.orderBy('name')
    })
    .first()

  if (!event) {
    throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
  }
  return event
}

export default class EventProductsController {
  /** Le menu d'une soirée, recettes par ordre alphabétique. */
  async index({ params, serialize }: HttpContext) {
    const event = await loadEventWithMenu(params.id)
    return serialize(event.products.map(toMenuLine))
  }
}
