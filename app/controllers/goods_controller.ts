import type { HttpContext } from '@adonisjs/core/http'
import Good from '#models/good'
import ApiException from '#exceptions/api_exception'
import { bestSupplierPrice, supplierPrices } from '#services/pricing_service'

/** Code d'unicité violée de Postgres. */
const UNIQUE_VIOLATION = '23505'

/** Une collision d'unicité est un geste ordinaire — le mauvais paquet scanné —
 *  pas une panne serveur. */
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
    // Un filtre plutôt qu'une route dédiée, pour ne pas dépendre de l'ordre de
    // déclaration face à `/goods/:id`.
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
    // La colonne est NOT NULL : sans ce défaut, créer un produit sans marque
    // partait en 500.
    good.brand = brand ?? ''
    good.categoryId = categoryId
    // Une chaîne vide passerait l'unicité une fois, puis collisionnerait.
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
    // Une clé absente ne doit pas effacer la marque existante.
    if ('brand' in payload) good.brand = payload.brand ?? ''
    // Clé présente seulement : associer un code sans réécrire la fiche.
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
