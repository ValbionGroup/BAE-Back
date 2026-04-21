import type { HttpContext } from '@adonisjs/core/http'
import Log from '#models/log'

export default class LogsController {
  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    const logs = await Log.query().preload('user')
    return logs
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request }: HttpContext) {
    const { level, message, method, url, ip, meta, userId } = request.all()
    const log = await Log.create({
      level,
      message,
      method,
      url,
      ip,
      meta,
      userId,
    })
    return log
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {
    const log = await Log.query().where('id', params.id).preload('user').firstOrFail()
    return log
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {
    const log = await Log.query().where('id', params.id).firstOrFail()
    const { level, message, method, url, ip, meta, userId } = request.all()
    log.level = level
    log.message = message
    log.method = method
    log.url = url
    log.ip = ip
    log.meta = meta
    log.userId = userId
    await log.save()
    return log
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const log = await Log.query().where('id', params.id).preload('user').firstOrFail()
    await log.delete()
  }
}
