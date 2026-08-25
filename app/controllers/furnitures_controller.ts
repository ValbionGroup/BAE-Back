import type { HttpContext } from '@adonisjs/core/http'
import Furniture from '#models/furniture'

/** ⚠️ `price` est reçu et stocké en **centimes entiers**. */
export default class FurnituresController {
  async index({ serialize }: HttpContext) {
    return serialize(await Furniture.all())
  }

  async store({ request, serialize }: HttpContext) {
    const { name, quantity, price } = request.all()
    return serialize(await Furniture.create({ name, quantity, price }))
  }

  async show({ params, serialize }: HttpContext) {
    return serialize(await Furniture.findOrFail(params.id))
  }

  async update({ params, request, serialize }: HttpContext) {
    const furniture = await Furniture.findOrFail(params.id)
    const { name, quantity, price } = request.all()
    furniture.merge({ name, quantity, price })
    await furniture.save()
    return serialize(furniture)
  }

  async destroy({ params }: HttpContext) {
    const furniture = await Furniture.findOrFail(params.id)
    return furniture.delete()
  }
}
