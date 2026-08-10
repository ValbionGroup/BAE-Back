import type { HttpContext } from '@adonisjs/core/http'
import Good from '#models/good'
import ApiException from '#exceptions/api_exception'
import { bestSupplierPrice, supplierPrices } from '#services/pricing_service'

/** Code d'unicité violée de Postgres. */
const UNIQUE_VIOLATION = '23505'

/**
 * Traduit la collision de code-barres en refus lisible.
 *
 * `goods.barcode` est unique : rattacher à un produit un code déjà porté par un
 * autre remonterait sinon en 500, alors que c'est un geste ordinaire de
 * l'utilisateur — il vient de scanner le mauvais paquet. Le message dit quoi
 * faire, ce qu'un « Internal server error » ne peut pas.
 */
function rethrowBarcodeConflict(error: unknown): never {
  if ((error as { code?: string })?.code === UNIQUE_VIOLATION) {
    throw new ApiException(
      'E_BARCODE_TAKEN',
      'Ce code-barres est déjà associé à un autre produit.',
      409
    )
  }
  throw error
}

export default class GoodsController {
  /**
   * Display a list of resource.
   *
   * `suppliers` carries the `good_suppliers.price` pivot value, coerced to a
   * number (the column is `decimal(10,2)`, which `pg` returns as a string) and
   * sorted cheapest first. This is what feeds the multi-retailer shopping list:
   * the frontend renders one column per supplier and highlights `bestSupplier`.
   */
  async index({ request, serialize }: HttpContext) {
    // `?barcode=` sert le scanner : un code lu résout vers zéro ou un produit,
    // la colonne étant unique. Un filtre plutôt qu'une route dédiée, pour ne
    // pas avoir à la déclarer avant `/goods/:id` et dépendre de l'ordre.
    const barcode = request.qs().barcode
    const goods = await Good.query()
      .preload('products')
      .preload('category')
      .preload('suppliers')
      .if(barcode, (query) => query.where('barcode', String(barcode)))
      .orderBy('name')

    return serialize(
      goods.map((good) => {
        const best = bestSupplierPrice(good)
        return {
          ...good.serialize(),
          suppliers: supplierPrices(good),
          bestSupplier: best,
          bestPrice: best?.price ?? null,
        }
      })
    )
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { name, unit, brand, categoryId, barcode } = request.all()
    const good = new Good()
    good.name = name
    good.unit = unit
    // `?? ''` : la colonne est NOT NULL, et une marque absente est le cas
    // ordinaire. Sans ce défaut, créer un produit sans marque partait en 500 —
    // ce que l'endpoint faisait depuis toujours, faute de test.
    good.brand = brand ?? ''
    good.categoryId = categoryId
    // `?? null` et non la valeur nue : une chaîne vide passerait la contrainte
    // d'unicité une première fois puis collisionnerait avec le produit suivant
    // créé sans code.
    good.barcode = barcode || null
    await good.save().catch(rethrowBarcodeConflict)
    return serialize(good)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    return serialize(
      await Good.query()
        .preload('products')
        .preload('category')
        .preload('suppliers')
        .where('id', params.id)
        .firstOrFail()
    )
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
    const good = await Good.query()
      .preload('products')
      .preload('category')
      .preload('suppliers')
      .where('id', params.id)
      .firstOrFail() // We get our good by id
    const payload = request.all()
    good.name = payload.name
    good.unit = payload.unit
    good.categoryId = payload.categoryId
    // Même prudence que pour le code-barres : une clé absente ne doit pas
    // effacer la marque existante, et la colonne étant NOT NULL, l'absence de
    // valeur vaut chaîne vide.
    if ('brand' in payload) good.brand = payload.brand ?? ''
    // Seulement si la clé est présente : c'est ce qui permet d'associer un code
    // à un produit existant sans réécrire le reste de sa fiche, et de le
    // détacher en envoyant `null` explicitement.
    if ('barcode' in payload) good.barcode = payload.barcode || null
    await good.save().catch(rethrowBarcodeConflict)
    return serialize(good)
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const good = await Good.query()
      .preload('products')
      .preload('category')
      .preload('suppliers')
      .where('id', params.id)
      .firstOrFail()
    await good.delete()
  }
}
