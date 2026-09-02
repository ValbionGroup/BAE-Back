import type { HttpContext } from '@adonisjs/core/http'
import { analyticsForSeason } from '#services/analytics_service'

export default class AnalyticsController {
  async season({ request, serialize }: HttpContext) {
    const raw = request.qs().season
    const parsed = raw === undefined || raw === '' ? Number.NaN : Number(raw)
    const requested = Number.isInteger(parsed) ? parsed : null

    return serialize(await analyticsForSeason(requested))
  }
}
