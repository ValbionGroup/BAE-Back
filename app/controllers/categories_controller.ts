import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import { categoryUpdateValidator, categoryValidator } from '#validators/catalog'

export default class CategoriesController {
  async index({ serialize }: HttpContext) {
    return serialize(await Category.all())
  }

  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(categoryValidator)
    return serialize(await Category.create(payload))
  }

  async show({ params, serialize }: HttpContext) {
    return serialize(await Category.findOrFail(params.id))
  }

  async update({ params, request, serialize }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    const payload = await request.validateUsing(categoryUpdateValidator)
    category.merge(payload)
    await category.save()
    return serialize(category)
  }

  async destroy({ params }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    return category.delete()
  }
}
