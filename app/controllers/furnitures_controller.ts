import type { HttpContext } from '@adonisjs/core/http'
import Furniture from '#models/furniture'

export default class FurnituresController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    return serialize(await Furniture.all())
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { name, quantity, price } = request.all()
    return serialize(await Furniture.create({ name, quantity, price }))
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    return serialize(await Furniture.findOrFail(params.id))
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
    const furniture = await Furniture.findOrFail(params.id)
    const { name, quantity, price } = request.all()
    furniture.merge({ name, quantity, price })
    await furniture.save()
    return serialize(furniture)
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const furniture = await Furniture.findOrFail(params.id)
    return furniture.delete()
  }
}
