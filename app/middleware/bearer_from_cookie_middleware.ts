import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { SESSION_COOKIE } from '#services/session_cookie'

/**
 * Traduit le cookie de session en en-tête `Authorization: Bearer`.
 *
 * Le `tokensGuard` d'AdonisJS ne lit **que** cet en-tête. Or en mode BFF le jeton
 * vit dans un cookie `httpOnly`, que le navigateur envoie tout seul et que le
 * front ne peut pas recopier — c'est précisément ce qui le protège d'une XSS.
 *
 * ⚠️ **Ce middleware doit rester avant `initialize_auth_middleware`, et donc
 * avant `silent_auth_middleware`.** Ce dernier appelle `ctx.auth.check()` sur
 * *chaque* requête, ce qui **met en cache** le résultat de l'authentification :
 * une fois l'échec mémorisé, poser l'en-tête plus tard ne change plus rien, et le
 * garde refuse un jeton pourtant valide. Le symptôme est déroutant — en-tête
 * identique octet pour octet à un appel qui réussit, et 401 quand même.
 *
 * L'en-tête explicite garde la **priorité** : tests fonctionnels, curl et
 * scripts d'exploitation continuent de fonctionner inchangés.
 */
export default class BearerFromCookieMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (ctx.request.header('authorization') === undefined) {
      const token = ctx.request.cookie(SESSION_COOKIE)
      if (typeof token === 'string' && token !== '') {
        ctx.request.request.headers.authorization = `Bearer ${token}`
      }
    }

    return next()
  }
}
