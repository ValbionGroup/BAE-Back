import type { HttpContext } from '@adonisjs/core/http'
import Good from '#models/good'

export default class GoodsController {
  /**
   * Display a list of resource
   */
  async index({ }: HttpContext) {
    //return Good.query().preload('products').preload('category').preload('suppliers')
    return Good.query().preload('products').preload('category')
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {
    const { name, unit, brand, categoryId } = request.all()
    const good = new Good()
    good.name = name
    good.unit = unit
    good.brand = brand
    good.categoryId = categoryId
    await good.save()
    return good
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    return await Good.query().preload('products').preload('category').where('id', params.id).firstOrFail()
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const good = await Good.query().preload('products').preload('category').where('id', params.id).firstOrFail() // We get our good by id
    const { name, unit, brand, categoryId } = request.all()
    good.name = name
    good.unit = unit
    good.brand = brand
    good.categoryId = categoryId
    await good.save()
    return good
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const good = await Good.query().preload('products').preload('category').where('id', params.id).firstOrFail()
    await good.delete()
  }
}