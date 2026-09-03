import type { HttpContext } from '@adonisjs/core/http'
import Furniture from '#models/furniture'
import { furnitureUpdateValidator, furnitureValidator } from '#validators/catalog'

/** ⚠️ `price` est reçu et stocké en **centimes entiers**. */
export default class FurnituresController {
  async index({ serialize }: HttpContext) {
    return serialize(await Furniture.all())
  }

  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(furnitureValidator)
    return serialize(await Furniture.create(payload))
  }

  async show({ params, serialize }: HttpContext) {
    return serialize(await Furniture.findOrFail(params.id))
  }

  async update({ params, request, serialize }: HttpContext) {
    const furniture = await Furniture.findOrFail(params.id)
    const payload = await request.validateUsing(furnitureUpdateValidator)
    furniture.merge(payload)
    await furniture.save()
    return serialize(furniture)
  }

  async destroy({ params }: HttpContext) {
    const furniture = await Furniture.findOrFail(params.id)
    return furniture.delete()
  }
}
