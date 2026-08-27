import Log from '#models/log'
import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { redactResponseBody, redactUrl } from '#services/log_redaction_service'

/**
 * Le corps de réponse n'est joint au journal que si `LOG_RESPONSE_BODY` le
 * demande. Il en faisait auparavant partie systématiquement : `logs` gagnait une
 * ligne grasse par requête, sans index ni purge, sur la base même que
 * l'application interroge.
 *
 * Lu une seule fois, au chargement du module : c'est un réglage de déploiement,
 * et le relire à chaque requête ne rendrait service à personne.
 */
const LOG_RESPONSE_BODY = env.get('LOG_RESPONSE_BODY', false)

export default class RequestLoggerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (ctx.request.method() === 'OPTIONS') {
      return next()
    }

    const start = process.hrtime.bigint()
    await next()
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000

    const status = ctx.response.getStatus()
    const level = status >= 500 ? 'error' : status >= 400 ? 'warning' : 'info'
    const method = ctx.request.method()
    const url = redactUrl(ctx.request.url(true))
    const message = `${method} ${url} → ${status} (${Math.round(durationMs)}ms)`
    const userId = (ctx.auth?.user as { id?: number } | undefined)?.id ?? null

    // La rédaction est récursive sur toute la charge utile : ne l'appeler que si
    // le résultat est destiné à être écrit, sinon c'est une traversée complète
    // pour rien, sur le chemin de chaque réponse.
    const response = LOG_RESPONSE_BODY ? redactResponseBody(url, ctx.response.getBody()) : undefined

    Log.create({
      level,
      message,
      method,
      url,
      ip: ctx.request.ip(),
      userId,
      meta: {
        status,
        durationMs: Math.round(durationMs),
        ...(response === undefined ? {} : { response }),
      },
    }).catch(() => {})
  }
}
