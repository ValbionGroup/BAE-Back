import type { HttpContext } from '@adonisjs/core/http'
import FastPass from '#models/fast_pass'

export default class FastPassesController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    return serialize(await FastPass.query())
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { price, duration, description, label } = request.all()
    const fastPass = new FastPass()
    fastPass.price = price
    fastPass.duration = duration
    fastPass.description = description
    fastPass.label = label
    await fastPass.save()
    return serialize(fastPass)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    return serialize(await FastPass.query().where('id', params.id).firstOrFail())
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
    const fastPass = await FastPass.query().where('id', params.id).firstOrFail() // We get our fast pass by id
    const { price, duration, description, label } = request.all() // We transfer the new data from the request to constants
    fastPass.price = price // Assigning the data
    fastPass.duration = duration
    fastPass.description = description
    fastPass.label = label
    await fastPass.save() // We save the fast pass to the database
    return serialize(fastPass)
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const fastPass = await FastPass.query().where('id', params.id).firstOrFail()
    await fastPass.delete()
  }
}
