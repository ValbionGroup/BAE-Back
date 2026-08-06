import type { HttpContext } from '@adonisjs/core/http'
import Log from '#models/log'

const DEFAULT_LOG_PAGE_SIZE = 50
const MAX_LOG_PAGE_SIZE = 200

export default class LogsController {
  /**
   * Display a list of resource, newest first.
   *
   * This used to return every row in one response — 500+ logs and well over a
   * megabyte, which the client then had to walk key by key through its case
   * converter. Paginated by default; `serialize()` emits `{ data, metadata }`
   * for a Lucid paginator.
   */
  async index({ request, serialize }: HttpContext) {
    const page = Math.max(1, Number(request.input('page', 1)) || 1)
    const requested = Number(request.input('limit', DEFAULT_LOG_PAGE_SIZE)) || DEFAULT_LOG_PAGE_SIZE
    const limit = Math.min(MAX_LOG_PAGE_SIZE, Math.max(1, requested))

    const logs = await Log.query().preload('user').orderBy('id', 'desc').paginate(page, limit)
    return serialize(logs)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
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
    return serialize(log)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    const log = await Log.query().where('id', params.id).preload('user').firstOrFail()
    return serialize(log)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
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
    return serialize(log)
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const log = await Log.query().where('id', params.id).preload('user').firstOrFail()
    await log.delete()
  }
}
