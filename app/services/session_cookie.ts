import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'

/**
 * Le jeton d'accès voyage dans un cookie `httpOnly` : le front n'y a **jamais**
 * accès, c'est tout l'objet du mode BFF. Un jeton lisible en JavaScript est
 * exfiltrable par la moindre XSS ; un cookie `httpOnly` ne l'est pas.
 *
 * Centralisé ici parce que trois chemins le manipulent — connexion par mot de
 * passe, callback SSO, déconnexion — et que trois jeux d'options divergents
 * produiraient des sessions qui s'effacent mal ou pas du tout.
 */
export const SESSION_COOKIE = 'bae_token'

function options() {
  const domain = env.get('COOKIE_DOMAIN')

  return {
    httpOnly: true,
    // `lax` et non `strict` : le retour depuis l'IdP est une navigation GET de
    // premier niveau, et `strict` ferait perdre le cookie à chaque connexion SSO.
    sameSite: 'lax' as const,
    secure: env.get('NODE_ENV') === 'production',
    path: '/',
    /**
     * Sans `domain`, un cookie est **host-only** : il ne repart que vers l'hôte
     * exact qui l'a posé. En développement tout tient sur `localhost`, où le port
     * n'entre pas dans l'identité d'un cookie, donc l'absence passe inaperçue.
     *
     * En production les trois origines diffèrent (`api.`, `dashboard.`,
     * `order.bae.eirb.fr`) et le cookie posé par l'API ne serait envoyé par aucun
     * des deux fronts : la session serait muette, sans la moindre erreur. D'où
     * `.bae.eirb.fr`, qui est aussi ce que suppose l'allowlist CORS.
     *
     * Laissé de côté quand la variable est vide, plutôt que passé à `undefined` :
     * certaines piles sérialisent `Domain=undefined`, ce qui casse le cookie.
     */
    ...(domain ? { domain } : {}),
  }
}

export function setSessionCookie(response: HttpContext['response'], token: string): void {
  response.cookie(SESSION_COOKIE, token, options())
}

/**
 * ⚠️ Les options doivent être **les mêmes** qu'à la pose : un navigateur
 * n'efface pas un cookie dont le `path` ou le `sameSite` diffèrent, et la
 * déconnexion échouerait silencieusement.
 */
export function clearSessionCookie(response: HttpContext['response']): void {
  response.clearCookie(SESSION_COOKIE, options())
}
