import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import ApiException from '#exceptions/api_exception'
import JwtService from '#services/jwt_service'
import { activeSecretExists } from '#services/two_factor_service'
import {
  clearSessionCookie,
  clearTwoFactorCookie,
  setSessionCookie,
  setTwoFactorCookie,
} from '#services/session_cookie'
import { CHALLENGE_TTL_SECONDS } from '#controllers/two_factor_controller'

export default class AccessTokenController {
  async store({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const user = await User.verifyPasswordCredentials(email, password)

    if (await activeSecretExists(user.id)) {
      const challenge = await new JwtService().signTwoFactorChallenge(
        user.id,
        CHALLENGE_TTL_SECONDS
      )
      setTwoFactorCookie(response, challenge)

      throw new ApiException('E_TWO_FACTOR_REQUIRED', 'Un code de vérification est requis.', 401)
    }

    const token = await User.accessTokens.create(user)

    await db
      .from('auth_access_tokens')
      .where('id', Number(token.identifier))
      .update({
        ip_address: request.ip(),
        user_agent: request.header('user-agent') ?? null,
      })

    const value = token.value!.release()

    setSessionCookie(response, value)
    clearTwoFactorCookie(response)

    return { data: value }
  }

  async destroy({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.currentAccessToken) {
      await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    }

    clearSessionCookie(response)
    clearTwoFactorCookie(response)

    return response.noContent()
  }

  async destroyAll({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const tokens = await User.accessTokens.all(user)
    for (const token of tokens) {
      await User.accessTokens.delete(user, token.identifier)
    }

    clearSessionCookie(response)
    clearTwoFactorCookie(response)

    return response.noContent()
  }
}
