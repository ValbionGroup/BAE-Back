import type { HttpContext } from '@adonisjs/core/http'
import FastPass from '#models/fast_pass'

export default class FastPassesController {
  async index({ serialize }: HttpContext) {
    return serialize(await FastPass.query())
  }

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

  async show({ params, serialize }: HttpContext) {
    return serialize(await FastPass.query().where('id', params.id).firstOrFail())
  }

  async update({ params, request, serialize }: HttpContext) {
    const fastPass = await FastPass.query().where('id', params.id).firstOrFail()
    const { price, duration, description, label } = request.all()
    fastPass.price = price
    fastPass.duration = duration
    fastPass.description = description
    fastPass.label = label
    await fastPass.save()
    return serialize(fastPass)
  }

  async destroy({ params }: HttpContext) {
    const fastPass = await FastPass.query().where('id', params.id).firstOrFail()
    await fastPass.delete()
  }
}
