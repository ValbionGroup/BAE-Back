import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import { authorizationRequest, exchange } from '#services/oidc_service'
import { isSsoApp, provision } from '#services/sso_provisioning_service'
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

    const { url, state, codeVerifier } = await authorizationRequest()

    // `state`, `code_verifier` et l'intention vivent dans **la même** entrée de
    // session : les séparer (un cookie `sso_app` à part) créerait deux états
    // désynchronisables — un callback valide sans destination. Ici, si la session
    // est perdue, la validation du `state` échoue de toute façon : un seul mode
    // d'échec au lieu de deux.
    //
    // ⚠️ Le cookie de session est en `SameSite=Lax`, ce qui le fait survivre au
    // retour depuis l'IdP (navigation GET de premier niveau). En `Strict` il
    // serait perdu et **toutes** les connexions échoueraient sur une erreur
    // d'état — symptôme classique et très déroutant.
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

    // La destination n'est connue que par la session : sans elle, on ne sait même
    // pas vers quel front renvoyer l'erreur. Le dashboard est le repli.
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
      // `state` incohérent, code déjà consommé, `uid` absent : tous mènent ici.
      // Le détail va dans les logs et **jamais** dans l'URL du navigateur — mais
      // il doit y aller vraiment : un échec SSO muet est indiagnosticable, et
      // c'est exactement le genre de panne qu'on découvre en production.
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

    // Le jeton transite par un cookie `httpOnly` : le front n'obtient jamais de
    // jeton lisible, c'est tout l'objet du mode BFF.
    response.cookie('bae_token', token.value!.release(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.get('NODE_ENV') === 'production',
      path: '/',
    })

    return response.redirect(front)
  }
}
