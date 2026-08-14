import type { HttpContext } from '@adonisjs/core/http'
import Good from '#models/good'
import ApiException from '#exceptions/api_exception'
import { bestSupplierPrice, supplierPrices } from '#services/pricing_service'

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
}
