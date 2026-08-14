import Log from '#models/log'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { redactResponseBody } from '#services/log_redaction_service'

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
    const url = ctx.request.url(true)
    const message = `${method} ${url} → ${status} (${Math.round(durationMs)}ms)`
    const userId = (ctx.auth?.user as { id?: number } | undefined)?.id ?? null

    const response = redactResponseBody(url, ctx.response.getBody())

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
