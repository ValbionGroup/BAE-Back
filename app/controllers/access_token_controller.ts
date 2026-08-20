import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { clearSessionCookie, setSessionCookie } from '#services/session_cookie'

export default class AccessTokenController {
  async store({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    // `verifyPasswordCredentials` et non `verifyCredentials` : voir le garde du
    // modèle, sans lequel un compte SSO (mot de passe `null`) produit un 500.
    const user = await User.verifyPasswordCredentials(email, password)
    const token = await User.accessTokens.create(user)

    await db
      .from('auth_access_tokens')
      .where('id', Number(token.identifier))
      .update({
        ip_address: request.ip(),
        user_agent: request.header('user-agent') ?? null,
      })

    const value = token.value!.release()

    // Le cookie est la voie du navigateur ; le corps reste rempli pour les
    // appels hors navigateur (tests, scripts). Les deux portent le même jeton.
    setSessionCookie(response, value)

    return { data: value }
  }

  async destroy({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.currentAccessToken) {
      await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    }

    // Seul le serveur peut effacer un cookie `httpOnly` : sans cette ligne, le
    // navigateur continuerait de présenter un jeton que la base a révoqué.
    clearSessionCookie(response)

    return response.noContent()
  }

  async destroyAll({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const tokens = await User.accessTokens.all(user)
    for (const token of tokens) {
      await User.accessTokens.delete(user, token.identifier)
    }

    // Même raison que dans `destroy` : la session courante fait partie du lot,
    // et un cookie laissé en place présenterait un jeton déjà révoqué.
    clearSessionCookie(response)

    return response.noContent()
  }
}
