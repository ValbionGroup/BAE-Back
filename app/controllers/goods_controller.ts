import type { HttpContext } from '@adonisjs/core/http'
import Good from '#models/good'
import ApiException from '#exceptions/api_exception'
import { bestSupplierPrice, supplierPrices } from '#services/pricing_service'
import Supplier from '#models/supplier'
import { supplierPriceValidator } from '#validators/catalog'

const UNIQUE_VIOLATION = '23505'

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
  async index({ request, serialize }: HttpContext) {
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

  async store({ request, serialize }: HttpContext) {
    const { name, unit, brand, categoryId, barcode } = request.all()
    const good = new Good()
    good.name = name
    good.unit = unit
    good.brand = brand ?? ''
    good.categoryId = categoryId
    good.barcode = barcode || null
    await good.save().catch(rethrowBarcodeConflict)
    return serialize(good)
  }

  /**
   * ⚠️ Même forme que `index` pour les tarifs : `preload('suppliers')` seul rend
   * les enseignes **sans leur prix**, qui vit sur le pivot dans
   * `$extras.pivot_price` et ne se sérialise pas. Le panneau de tarifs lit cette
   * réponse — sans `supplierPrices`, il afficherait des enseignes sans montant.
   */
  async show({ params, serialize }: HttpContext) {
    const good = await Good.query()
      .preload('products')
      .preload('category')
      .preload('suppliers')
      .where('id', params.id)
      .firstOrFail()

    const best = bestSupplierPrice(good)
    return serialize({
      ...good.serialize(),
      suppliers: supplierPrices(good),
      bestSupplier: best,
      bestPrice: best?.price ?? null,
    })
  }

  async update({ params, request, serialize }: HttpContext) {
    const good = await Good.query()
      .preload('products')
      .preload('category')
      .preload('suppliers')
      .where('id', params.id)
      .firstOrFail()
    const payload = request.all()
    good.name = payload.name
    good.unit = payload.unit
    good.categoryId = payload.categoryId
    if ('brand' in payload) good.brand = payload.brand ?? ''
    if ('barcode' in payload) good.barcode = payload.barcode || null
    await good.save().catch(rethrowBarcodeConflict)
    return serialize(good)
  }

  async destroy({ params }: HttpContext) {
    const good = await Good.query()
      .preload('products')
      .preload('category')
      .preload('suppliers')
      .where('id', params.id)
      .firstOrFail()
    await good.delete()
  }

  /**
   * Pose ou corrige le tarif d'une denrée chez une enseigne — **le même geste**
   * du point de vue de l'utilisateur, donc la même route.
   *
   * ⚠️ Ce prix décide de trois écrans : `bestSupplierPrice` en fait le prix de
   * référence du coût de recette, de la liste de courses et du bilan. Saisir
   * moins cher ailleurs les déplace tous les trois.
   */
  async setSupplierPrice({ params, request, response }: HttpContext) {
    const good = await Good.query().where('id', params.id).firstOrFail()
    const { priceCents } = await request.validateUsing(supplierPriceValidator)

    // Vérifié explicitement : sans ça, un identifiant inconnu remonterait en
    // violation de clé étrangère, donc en 500 illisible.
    const supplier = await Supplier.find(params.supplierId)
    if (!supplier) {
      throw new ApiException('E_SUPPLIER_NOT_FOUND', "Cette enseigne n'existe pas.", 404)
    }

    // `sync(..., false)` : détacher les autres enseignes effacerait les tarifs
    // qu'on ne touche pas.
    await good.related('suppliers').sync({ [supplier.id]: { price: priceCents } }, false)

    return response.ok({ goodId: good.id, supplierId: supplier.id, priceCents })
  }

  async removeSupplierPrice({ params, response }: HttpContext) {
    const good = await Good.query().where('id', params.id).firstOrFail()
    await good.related('suppliers').detach([Number(params.supplierId)])
    return response.noContent()
  }
}
