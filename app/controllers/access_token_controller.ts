import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class AccessTokenController {
  async store({ request }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(email, password)
    const token = await User.accessTokens.create(user)

    /**
     * `DbAccessTokensProvider.create()` builds a fixed insert payload
     * (tokenable_id, type, name, hash, abilities, timestamps) and exposes no
     * hook for extra columns — `options` only accepts `name` and `expiresIn`.
     * The device info is therefore written back onto the freshly created row,
     * keyed on the returned token identifier.
     */
    await db
      .from('auth_access_tokens')
      .where('id', Number(token.identifier))
      .update({
        ip_address: request.ip(),
        user_agent: request.header('user-agent') ?? null,
      })

    return { data: token.value!.release() }
  }

  async destroy({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.currentAccessToken) {
      await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    }

    return response.noContent()
  }

  async destroyAll({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const tokens = await User.accessTokens.all(user)
    for (const token of tokens) {
      await User.accessTokens.delete(user, token.identifier)
    }

    return response.noContent()
  }
}
