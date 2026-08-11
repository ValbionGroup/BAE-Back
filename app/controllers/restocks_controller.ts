import type { HttpContext } from '@adonisjs/core/http'
import Restock from '#models/restock'

export default class RestocksController {
  async index({ serialize }: HttpContext) {
    const restocks = await Restock.query()
      .preload('member')
      .preload('supplier')
      .preload('stockBatches')
    return serialize(restocks)
  }

  async store({ request, serialize }: HttpContext) {
    const { memberId, supplierId, totalPrice } = request.all()
    const restock = new Restock()
    restock.memberId = memberId
    restock.supplierId = supplierId
    restock.totalPrice = totalPrice
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

  async update({ params, request, serialize }: HttpContext) {
    const restock = await Restock.query()
      .preload('member')
      .preload('supplier')
      .preload('stockBatches')
      .where('id', params.id)
      .firstOrFail()
    const { memberId, supplierId, totalPrice } = request.all()
    restock.memberId = memberId
    restock.supplierId = supplierId
    restock.totalPrice = totalPrice
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
