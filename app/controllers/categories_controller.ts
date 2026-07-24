import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'

export default class CategoriesController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    return serialize(await Category.all())
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const data = request.all()
    return serialize(await Category.create(data))
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    return serialize(await Category.findOrFail(params.id))
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    const data = request.all()
    category.merge(data)
    await category.save()
    return serialize(category)
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    return category.delete()
  }
}
