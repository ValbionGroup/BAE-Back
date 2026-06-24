import type { HttpContext } from '@adonisjs/core/http'
import Furniture from '#models/furniture'

export default class FurnituresController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    return Furniture.all()
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {
    const { name, quantity, price } = request.all()
    return Furniture.create({ name, quantity, price })
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    return Furniture.findOrFail(params.id)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const furniture = await Furniture.findOrFail(params.id)
    const { name, quantity, price } = request.all()
    furniture.merge({ name, quantity, price })
    return furniture.save()
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const furniture = await Furniture.findOrFail(params.id)
    return furniture.delete()
  }
}
