import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import { authorizationRequest, exchange } from '#services/oidc_service'
import { isSsoApp, provision } from '#services/sso_provisioning_service'
import { setSessionCookie } from '#services/session_cookie'
import type { SsoApp } from '#services/sso_provisioning_service'

/** Une seule entrée de session porte les trois valeurs — voir `redirect()`. */
const PENDING_KEY = 'sso_pending'

type PendingLogin = { state: string; codeVerifier: string; app: SsoApp }

function frontendUrl(app: SsoApp): string {
  return app === 'dashboard' ? env.get('DASHBOARD_URL') : env.get('PUBLIC_APP_URL')
}

/**
 * SSO en mode BFF. Deux routes seulement, et **une seule URI de callback** :
 * chacune doit être whitelistée par EirbWare, donc chaque URI supplémentaire est
 * un aller-retour humain de plus.
 */
export default class KeycloakAuthController {
  /**
   * ⚠️ Ne jamais accepter d'URL de retour en paramètre : `?redirect_uri=` accepté
   * tel quel est une redirection ouverte offerte à qui veut hameçonner. Le client
   * n'envoie qu'un **mot-clé** d'une liste fermée, et la destination se résout
   * côté serveur.
   */
  async redirect({ request, response, session }: HttpContext) {
    const app = request.input('app', 'dashboard')

    if (!isSsoApp(app)) {
      return response.badRequest({ error: { code: 'E_INVALID_APP', message: 'Zone inconnue.' } })
    }

    let authorization
    try {
      authorization = await authorizationRequest()
    } catch (error) {
      logger.error({ err: error, app }, 'IdP injoignable à la demande d’autorisation')
      return response.redirect(`${frontendUrl(app)}/login?sso_error=idp_unavailable`)
    }

    const { url, state, codeVerifier } = authorization
    session.put(PENDING_KEY, { state, codeVerifier, app } satisfies PendingLogin)

    return response.redirect(url)
  }

  /**
   * Les sorties d'erreur sont traitées **avant tout le reste** : sans ça
   * l'utilisateur tombe sur une page blanche au lieu d'un message.
   */
  async callback({ request, response, session }: HttpContext) {
    const pending = session.get(PENDING_KEY) as PendingLogin | undefined
    session.forget(PENDING_KEY)

    const app: SsoApp = pending?.app ?? 'dashboard'
    const front = frontendUrl(app)

    const idpError = request.input('error')
    if (typeof idpError === 'string' && idpError !== '') {
      // Couvre aussi le refus de consentement (`access_denied`).
      return response.redirect(`${front}/login?sso_error=${encodeURIComponent(idpError)}`)
    }

    if (pending === undefined) {
      return response.redirect(`${front}/login?sso_error=session_expired`)
    }

    let claims
    try {
      const currentUrl = new URL(request.completeUrl(true))
      claims = await exchange(currentUrl, pending)
    } catch (error) {
      logger.error({ err: error, app }, 'échec de l’échange de code SSO')
      return response.redirect(`${front}/login?sso_error=exchange_failed`)
    }

    const outcome = await provision(app, claims)

    if (outcome.status === 'not-a-member') {
      return response.redirect(`${front}/login?sso_error=not_a_member`)
    }

    const token = await User.accessTokens.create(outcome.user)

    await db
      .from('auth_access_tokens')
      .where('id', Number(token.identifier))
      .update({
        ip_address: request.ip(),
        user_agent: request.header('user-agent') ?? null,
      })

    setSessionCookie(response, token.value!.release())
    return response.redirect(front)
  }
}
