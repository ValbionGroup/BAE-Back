import type { HttpContext } from '@adonisjs/core/http'
import Restock from '#models/restock'

export default class RestocksController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    const restocks = await Restock.query()
      .preload('member')
      .preload('supplier')
      .preload('stockBatches')
    return serialize(restocks)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { memberId, supplierId, totalPrice } = request.all()
    const restock = new Restock()
    restock.memberId = memberId
    restock.supplierId = supplierId
    restock.totalPrice = totalPrice
    await restock.save()
    return serialize(restock)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    const restock = await Restock.query()
      .preload('member')
      .preload('supplier')
      .preload('stockBatches')
      .where('id', params.id)
      .firstOrFail()
    return serialize(restock)
  }

  /**
   * Handle form submission for the edit action
   */
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

  /**
   * Delete record
   */
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
