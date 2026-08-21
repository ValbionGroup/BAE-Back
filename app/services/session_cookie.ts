import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'

export const SESSION_COOKIE = 'bae_token'
export const TWO_FACTOR_COOKIE = 'bae_2fa'

function options() {
  const domain = env.get('COOKIE_DOMAIN')

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.get('NODE_ENV') === 'production',
    path: '/',
    ...(domain ? { domain } : {}),
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
