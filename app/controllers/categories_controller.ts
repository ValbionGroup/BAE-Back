import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'

export default class CategoriesController {
  async index({ serialize }: HttpContext) {
    return serialize(await Category.all())
  }

  async store({ request, serialize }: HttpContext) {
    const data = request.all()
    return serialize(await Category.create(data))
  }

  async show({ params, serialize }: HttpContext) {
    return serialize(await Category.findOrFail(params.id))
  }

  async update({ params, request, serialize }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    const data = request.all()
    category.merge(data)
    await category.save()
    return serialize(category)
  }

  async destroy({ params }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    return category.delete()
  }
}
