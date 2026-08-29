import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'

export const SESSION_COOKIE = 'bae_token'
export const TWO_FACTOR_COOKIE = 'bae_2fa'

/** Cookie lifespan. */
export const SESSION_TTL_SECONDS = 2 * 60 * 60

/**
 * The domain scope shared by **every** session cookie, including the
 * `XSRF-TOKEN` cookie set by `config/shield.ts`.
 *
 * ⚠️ The CSRF cookie must carry exactly the same scope as the session cookie —
 * that is the whole reason this function is shared. The front-end lives on a
 * different subdomain than the API (`erp.bae.valbion.com` against
 * `api.bae.valbion.com`), and a *host-only* cookie set by the API is
 * **unreadable** from JavaScript on the front-end. The double-submit pattern
 * then has nothing to copy into `X-XSRF-TOKEN`, and every cookie-authenticated
 * write is rejected with a 403 — login included, as soon as the browser still
 * holds a stale `bae_token`.
 *
 * The domain is **omitted** rather than set to `undefined`: some stacks
 * serialise `Domain=undefined`, and the cookie is then lost.
 */
export function cookieScope(): { domain?: string } {
  const domain = env.get('COOKIE_DOMAIN')

  return domain ? { domain } : {}
}

function options() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.get('NODE_ENV') === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    ...cookieScope(),
  }
}

export function setSessionCookie(response: HttpContext['response'], token: string): void {
  response.cookie(SESSION_COOKIE, token, options())
}

export function clearSessionCookie(response: HttpContext['response']): void {
  response.clearCookie(SESSION_COOKIE, options())
}

export function setTwoFactorCookie(response: HttpContext['response'], token: string): void {
  response.cookie(TWO_FACTOR_COOKIE, token, options())
}

export function clearTwoFactorCookie(response: HttpContext['response']): void {
  response.clearCookie(TWO_FACTOR_COOKIE, options())
}
