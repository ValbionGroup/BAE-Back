import type { HttpContext } from '@adonisjs/core/http'
import Log from '#models/log'

const DEFAULT_LOG_PAGE_SIZE = 50
const MAX_LOG_PAGE_SIZE = 200

export default class LogsController {
  async index({ request, serialize }: HttpContext) {
    const page = Math.max(1, Number(request.input('page', 1)) || 1)
    const requested = Number(request.input('limit', DEFAULT_LOG_PAGE_SIZE)) || DEFAULT_LOG_PAGE_SIZE
    const limit = Math.min(MAX_LOG_PAGE_SIZE, Math.max(1, requested))

    const paginator = await Log.query().preload('user').orderBy('id', 'desc').paginate(page, limit)
    // `.all()` rather than the paginator itself: `Array.isArray()` is true for a
    // `ModelPaginator`, so `case_converter_middleware` walks it as a plain array
    // and chokes on its internals.
    const payload = await serialize(paginator.all())

    return {
      ...payload,
      metadata: {
        total: paginator.total,
        perPage: paginator.perPage,
        currentPage: paginator.currentPage,
        lastPage: paginator.lastPage,
      },
    }
  }

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

  async show({ params, serialize }: HttpContext) {
    const log = await Log.query().where('id', params.id).preload('user').firstOrFail()
    return serialize(log)
  }

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

  async destroy({ params }: HttpContext) {
    const log = await Log.query().where('id', params.id).preload('user').firstOrFail()
    await log.delete()
  }
}
