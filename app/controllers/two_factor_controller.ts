import type { HttpContext } from '@adonisjs/core/http'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import ApiException from '#exceptions/api_exception'
import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import JwtService from '#services/jwt_service'
import {
  activeSecretExists,
  confirmEnrolment,
  consumeRecoveryCode,
  disable,
  issueRecoveryCodes,
  startEnrolment,
  twoFactorStateOf,
  verifyTotp,
} from '#services/two_factor_service'
import { clearTwoFactorCookie, setSessionCookie, TWO_FACTOR_COOKIE } from '#services/session_cookie'
import {
  twoFactorConfirmValidator,
  twoFactorDisableValidator,
  twoFactorVerifyValidator,
} from '#validators/two_factor'

export const CHALLENGE_TTL_SECONDS = 5 * 60

const MAX_ATTEMPTS = 5

export default class TwoFactorController {
  async store({ auth, serialize, response }: HttpContext) {
    const user = auth.getUserOrFail()

    if (user.password === null) {
      throw new BadRequestException(
        'E_NO_PASSWORD_SET',
        "Ce compte se connecte via EirbConnect : il n'a pas de mot de passe à protéger."
      )
    }

    if (await activeSecretExists(user.id)) {
      throw new ApiException(
        'E_TWO_FACTOR_ALREADY_ENABLED',
        'La double authentification est déjà active.',
        409
      )
    }

    response.status(201)
    return serialize(await startEnrolment(user.id, user.email))
  }

  async confirm({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const { code } = await request.validateUsing(twoFactorConfirmValidator)

    if (await activeSecretExists(user.id)) {
      throw new ApiException(
        'E_TWO_FACTOR_ALREADY_ENABLED',
        'La double authentification est déjà active.',
        409
      )
    }

    const recoveryCodes = await confirmEnrolment(user.id, code)
    if (recoveryCodes === null) {
      throw new BadRequestException('E_INVALID_TWO_FACTOR_CODE', 'Ce code est incorrect.')
    }

    return serialize({ recoveryCodes })
  }

  async recoveryCodes({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    if (!(await activeSecretExists(user.id))) {
      throw new NotFoundException('Two factor')
    }

    return serialize({ recoveryCodes: await issueRecoveryCodes(user.id) })
  }

  async disable({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { password } = await request.validateUsing(twoFactorDisableValidator)

    if (!(await activeSecretExists(user.id))) {
      throw new NotFoundException('Two factor')
    }

    await User.verifyPasswordCredentials(user.email, password)
    await disable(user.id)

    return response.noContent()
  }

  async challenge({ request, serialize }: HttpContext) {
    const token = request.cookie(TWO_FACTOR_COOKIE)
    const userId = token === undefined ? null : await this.challengeUserId(token)

    if (userId === null) {
      throw new ApiException('E_TWO_FACTOR_CHALLENGE_INVALID', 'Cette vérification a expiré.', 401)
    }

    return serialize({
      pending: true,
      expiresAt: DateTime.now().plus({ seconds: CHALLENGE_TTL_SECONDS }).toISO(),
    })
  }

  async verify({ request, response, serialize }: HttpContext) {
    const token = request.cookie(TWO_FACTOR_COOKIE)
    const userId = token === undefined ? null : await this.challengeUserId(token)

    if (userId === null) {
      clearTwoFactorCookie(response)
      throw new ApiException(
        'E_TWO_FACTOR_CHALLENGE_INVALID',
        'Cette vérification a expiré. Recommencez la connexion.',
        401
      )
    }

    const { code, recoveryCode } = await request.validateUsing(twoFactorVerifyValidator)
    if ((code === undefined) === (recoveryCode === undefined)) {
      throw new BadRequestException(
        'E_INVALID_TWO_FACTOR_CODE',
        'Fournissez un code de vérification ou un code de secours.'
      )
    }

    const throttle = limiter.use({
      requests: MAX_ATTEMPTS,
      duration: '5 mins',
      blockDuration: '15 mins',
    })

    let rateLimited = false
    try {
      const [exhausted] = await throttle.penalize(`2fa:${userId}`, async () => {
        const ok =
          code !== undefined
            ? await verifyTotp(userId, code)
            : await consumeRecoveryCode(userId, recoveryCode!)

        if (!ok) throw new Error('code refusé')
        return true
      })
      rateLimited = exhausted !== null
    } catch {
      throw new ApiException('E_INVALID_TWO_FACTOR_CODE', 'Ce code est incorrect.', 401)
    }

    if (rateLimited) {
      clearTwoFactorCookie(response)
      throw new ApiException(
        'E_TOO_MANY_REQUESTS',
        'Trop de tentatives. Recommencez la connexion dans quelques minutes.',
        429
      )
    }

    const user = await User.findOrFail(userId)
    const accessToken = await User.accessTokens.create(user)

    await db
      .from('auth_access_tokens')
      .where('id', Number(accessToken.identifier))
      .update({
        ip_address: request.ip(),
        user_agent: request.header('user-agent') ?? null,
      })

    const value = accessToken.value!.release()
    setSessionCookie(response, value)
    clearTwoFactorCookie(response)

    const state = await twoFactorStateOf(userId)

    return serialize({
      token: value,
      recoveryCodesRemaining: code !== undefined ? null : state.recoveryCodesRemaining,
    })
  }

  private async challengeUserId(token: string): Promise<number | null> {
    try {
      return await new JwtService().verifyTwoFactorChallenge(token)
    } catch {
      return null
    }
  }
}
