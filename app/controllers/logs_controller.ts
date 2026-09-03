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

  async show({ params, serialize }: HttpContext) {
    const log = await Log.query().where('id', params.id).preload('user').firstOrFail()
    return serialize(log)
  }

  /**
   * ⚠️ Aucun `store` ni `update` ici, délibérément : le journal est écrit par
   * `request_logger_middleware`, jamais par un client. Les rouvrir rendrait la
   * trace d'audit forgeable par son propre lecteur.
   */
  async destroy({ params }: HttpContext) {
    const log = await Log.query().where('id', params.id).preload('user').firstOrFail()
    await log.delete()
  }
}
