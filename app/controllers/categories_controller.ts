import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'

export default class CategoriesController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    return Category.all()
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {
    const data = request.all()
    return Category.create(data)
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    return Category.findOrFail(params.id)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    const data = request.all()
    category.merge(data)
    return category.save()
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    return category.delete()
  }
}