import type { HttpContext } from '@adonisjs/core/http'
import Restock from '#models/restock'
import { restockUpdateValidator, restockValidator } from '#validators/stock'

/** ⚠️ `totalPrice` est reçu et stocké en **centimes entiers**. */
export default class RestocksController {
  async index({ serialize }: HttpContext) {
    const restocks = await Restock.query()
      .preload('member')
      .preload('supplier')
      .preload('stockBatches')
    return serialize(restocks)
  }

  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(restockValidator)
    const restock = new Restock()
    restock.memberId = payload.memberId ?? null
    restock.supplierId = payload.supplierId ?? null
    restock.totalPrice = payload.totalPrice
    await restock.save()
    return serialize(restock)
  }

  async show({ params, serialize }: HttpContext) {
    const restock = await Restock.query()
      .preload('member')
      .preload('supplier')
      .preload('stockBatches')
      .where('id', params.id)
      .firstOrFail()
    return serialize(restock)
  }

  /** `merge` et non des affectations : Vine omet les clés absentes, donc un PATCH
   *  partiel ne réécrit plus les champs qu'il ne mentionne pas. */
  async update({ params, request, serialize }: HttpContext) {
    const restock = await Restock.query()
      .preload('member')
      .preload('supplier')
      .preload('stockBatches')
      .where('id', params.id)
      .firstOrFail()
    const payload = await request.validateUsing(restockUpdateValidator)
    restock.merge(payload)
    await restock.save()
    return serialize(restock)
  }

  async destroy({ params }: HttpContext) {
    const restock = await Restock.query()
      .preload('member')
      .preload('supplier')
      .preload('stockBatches')
      .where('id', params.id)
      .firstOrFail()
    await restock.delete()
  }
}
