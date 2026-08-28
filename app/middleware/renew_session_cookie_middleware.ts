import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { SESSION_COOKIE, setSessionCookie } from '#services/session_cookie'

/**
 * Repose le cookie de session à chaque requête authentifiée, pour transformer sa
 * durée de vie absolue en fenêtre glissante.
 *
 * ⚠️ Le `maxAge` d'un cookie court depuis sa **pose**, pas depuis la dernière
 * activité. Sans ce renouvellement, une session s'éteint exactement deux heures
 * après la connexion, fût-ce en pleine saisie — et rien ne peut la rattraper
 * après coup : le secret du jeton n'a jamais existé ailleurs que dans ce cookie
 * (`token.value!.release()` n'est stocké nulle part). Un « rafraîchissement
 * silencieux » déclenché sur le 401 arriverait donc toujours trop tard ; la seule
 * fenêtre utile est **avant** l'expiration, c'est-à-dire ici.
 *
 * Trois garde-fous, dans cet ordre :
 *
 * 1. **Le cookie doit avoir servi.** Une requête authentifiée par en-tête — curl,
 *    `loginAs()`, les scripts d'exploitation — n'a jamais demandé de session
 *    navigateur ; lui en poser une ferait fuiter un jeton dans des journaux qui
 *    n'ont pas à le porter. C'est le pendant exact de la priorité que
 *    `BearerFromCookieMiddleware` accorde à l'en-tête.
 * 2. **L'authentification doit avoir réussi.** Prolonger un jeton que le garde
 *    vient de refuser reviendrait à ressusciter une session révoquée.
 * 3. **Le contrôleur ne doit pas avoir déjà écrit sur ce cookie.** `login` vient
 *    d'en poser un neuf, `logout` et `logout-all` viennent de l'effacer : réécrire
 *    par-dessus rendrait la déconnexion sans effet, puisque c'est le dernier
 *    `Set-Cookie` de même nom que le navigateur retient.
 */
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
