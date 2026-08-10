import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import Product from '#models/product'
import ApiException from '#exceptions/api_exception'
import { minSupplierPrice } from '#services/pricing_service'
import { primaryCategoryName } from '#services/product_category_service'
import { eventProductValidator, eventProductUpdateValidator } from '#validators/event_product'
import { buildShoppingList } from '#services/shopping_list_service'

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
 *
 * `category` est **dérivée**, pas stockée : `products` n'a pas de colonne de
 * catégorie. Elle est exposée ici parce que la caisse en fait ses onglets, et
 * que c'est sa seule source — voir `product_category_service`.
 */
interface MenuLinePayload {
  productId: number
  name: string
  isVegetarian: boolean
  quantity: number
  price: number
  unitCost: number | null
  totalCost: number | null
  category: string | null
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
    category: primaryCategoryName(product),
  }
}

/**
 * Charge une soirée avec son menu complet — recettes, denrées, fournisseurs,
 * catégories.
 *
 * `category` est préchargée en plus des fournisseurs parce que
 * `primaryCategoryName` la lit sur la denrée de plus bas rang : sans ce
 * préchargement la relation est absente et toute recette ressortirait sans
 * catégorie, silencieusement.
 *
 * Un 404 explicite plutôt que `firstOrFail()` : le contrat de l'API porte le
 * code, et `ApiException` est la seule exception que le gestionnaire d'erreurs
 * traite spécialement (une exception nue devient `E_INTERNAL_SERVER_ERROR`).
 */
async function loadEventWithMenu(id: string): Promise<Event> {
  const event = await Event.query()
    .where('id', id)
    .preload('products', (products) => {
      products.preload('goods', (goods) => {
        goods.preload('suppliers')
        goods.preload('category')
      })
      products.orderBy('name')
    })
    .first()

  if (!event) {
    throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
  }
  return event
}

/**
 * Le prix de vente le plus récent de ce produit, toutes soirées confondues.
 *
 * Même sous-requête que `ProductsController.summary` (`last_price`) : les deux
 * doivent donner le même nombre, sinon un article changerait de prix selon
 * l'écran qui le regarde. Renvoie 0 quand le produit n'a jamais été vendu.
 */
async function lastSalePrice(productId: number): Promise<number> {
  const row = await db
    .from('event_products')
    .join('events', 'events.id', 'event_products.event_id')
    .where('event_products.product_id', productId)
    .orderBy('events.date', 'desc')
    .select('event_products.price')
    .first()

  return row ? Number(row.price) : 0
}

/**
 * La ligne de pivot fraîchement écrite, rechargée avec tout ce dont
 * `toMenuLine` a besoin.
 *
 * Recharger plutôt que construire la réponse à la main : le coût dérivé
 * dépend des denrées et de leurs fournisseurs, et un objet assemblé de mémoire
 * finirait par diverger de ce que `index()` renvoie pour la même ligne.
 */
async function reloadLine(eventId: string, productId: number): Promise<MenuLinePayload> {
  const event = await loadEventWithMenu(eventId)
  const line = event.products.find((product) => product.id === productId)
  if (!line) {
    throw new ApiException('E_PRODUCT_NOT_FOUND', "Cette recette n'existe pas.", 404)
  }
  return toMenuLine(line)
}

export default class EventProductsController {
  /** Le menu d'une soirée, recettes par ordre alphabétique. */
  async index({ params, serialize }: HttpContext) {
    const event = await loadEventWithMenu(params.id)
    return serialize(event.products.map(toMenuLine))
  }

  /**
   * Ajoute une recette au menu.
   *
   * Le doublon est refusé avant l'écriture : la clé primaire composite
   * `(event_id, product_id)` le refuserait de toute façon, mais par une erreur
   * SQL brute que le client ne peut pas interpréter.
   */
  async store({ params, request, serialize }: HttpContext) {
    const event = await loadEventWithMenu(params.id)
    const payload = await request.validateUsing(eventProductValidator)

    const product = await Product.find(payload.productId)
    if (!product) {
      throw new ApiException('E_PRODUCT_NOT_FOUND', "Cette recette n'existe pas.", 404)
    }

    if (event.products.some((entry) => entry.id === product.id)) {
      throw new ApiException(
        'E_MENU_LINE_EXISTS',
        'Cette recette est déjà au menu de la soirée.',
        409
      )
    }

    const price = payload.price ?? (await lastSalePrice(product.id))
    await event.related('products').attach({
      [product.id]: { quantity: payload.quantity, price },
    })

    return serialize(await reloadLine(params.id, product.id))
  }

  /**
   * Change la quantité de production ou le prix de vente d'une ligne.
   *
   * `sync(..., false)` et non `attach()` : le second insérerait un doublon.
   * Le `false` désactive le détachement, sinon la synchronisation d'une seule
   * ligne effacerait tout le reste du menu.
   */
  async update({ params, request, serialize }: HttpContext) {
    const event = await loadEventWithMenu(params.id)
    const productId = Number(params.productId)

    const current = event.products.find((entry) => entry.id === productId)
    if (!current) {
      throw new ApiException(
        'E_PRODUCT_NOT_FOUND',
        "Cette recette n'est pas au menu de cette soirée.",
        404
      )
    }

    const payload = await request.validateUsing(eventProductUpdateValidator)
    await event.related('products').sync(
      {
        [productId]: {
          quantity: payload.quantity ?? Number(current.$extras.pivot_quantity),
          price: payload.price ?? Number(current.$extras.pivot_price),
        },
      },
      false
    )

    return serialize(await reloadLine(params.id, productId))
  }

  /** Retire une recette du menu. */
  async destroy({ params, response }: HttpContext) {
    const event = await loadEventWithMenu(params.id)
    const productId = Number(params.productId)

    if (!event.products.some((entry) => entry.id === productId)) {
      throw new ApiException(
        'E_PRODUCT_NOT_FOUND',
        "Cette recette n'est pas au menu de cette soirée.",
        404
      )
    }

    await event.related('products').detach([productId])
    return response.noContent()
  }

  /**
   * La liste de courses de la soirée : ce qui manque, et où l'acheter.
   *
   * Gardée par `menu:read` **et** `stock:read` : la réponse expose les
   * quantités en stock denrée par denrée. `menu:read` est au socle, donc c'est
   * `stock:read` qui restreint réellement — la liste de courses est un document
   * de logistique.
   */
  async shoppingList({ params, serialize }: HttpContext) {
    return serialize(await buildShoppingList(params.id))
  }
}
