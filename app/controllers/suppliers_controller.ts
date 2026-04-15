import type { HttpContext } from '@adonisjs/core/http'
import Supplier from '#models/supplier'

export default class SuppliersController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    return Supplier.query().preload('goods').preload('restocks')
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {
    const { name } = request.all()
    const supplier = new Supplier()
    supplier.name = name
    await supplier.save()
    return supplier
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    return await Supplier.query().preload('goods').preload('restocks').where('id', params.id).firstOrFail()
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const supplier = await Supplier.query().preload('goods').preload('restocks').where('id', params.id).firstOrFail() // We get our supplier by id
    const { name } = request.all() // We transfer the new data from the request to constants
    supplier.name = name // Assigning the data
    await supplier.save() // We save the supplier to the database
    return supplier
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const supplier = await Supplier.query().preload('goods').preload('restocks').where('id', params.id).firstOrFail() // Get the supplier by id
    await supplier.delete()
  }
}