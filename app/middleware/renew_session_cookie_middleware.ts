import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { SESSION_COOKIE, setSessionCookie } from '#services/session_cookie'

export default class RenewSessionCookieMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const presented = ctx.request.cookie(SESSION_COOKIE)

    await next()

    if (typeof presented !== 'string' || presented === '') return
    if (!ctx.auth.isAuthenticated) return
    if (this.#alreadyWritten(ctx)) return

    setSessionCookie(ctx.response, presented)
  }

  #alreadyWritten(ctx: HttpContext): boolean {
    const header = ctx.response.getHeader('set-cookie')
    const cookies = Array.isArray(header) ? header : header === undefined ? [] : [String(header)]

    return cookies.some((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
  }
}
