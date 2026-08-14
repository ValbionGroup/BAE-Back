import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import ApiException from '#exceptions/api_exception'
import NotFoundException from '#exceptions/not_found_exception'

const TOKENS_TABLE = 'auth_access_tokens'
const TOKEN_TYPE = 'auth_token'

interface SessionRow {
  id: number
  name: string | null
  ip_address: string | null
  user_agent: string | null
  last_used_at: Date | string | null
  created_at: Date | string | null
  expires_at: Date | string | null
}

function toIso(value: Date | string | null): string | null {
  if (value === null || value === undefined) {
    return null
  }
  if (value instanceof Date) {
    return DateTime.fromJSDate(value).toISO()
  }
  return DateTime.fromISO(value).toISO() ?? value
}

export default class SessionsController {
  async index({ auth, serialize }: HttpContext) {
    const user = auth.use('api').getUserOrFail()
    const currentIdentifier = user.currentAccessToken?.identifier

    const rows = await db
      .from(TOKENS_TABLE)
      .select('id', 'name', 'ip_address', 'user_agent', 'last_used_at', 'created_at', 'expires_at')
      .where('tokenable_id', user.id)
      .where('type', TOKEN_TYPE)
      .orderBy('created_at', 'desc')

    // Payload built field by field, never by spreading the row: the token `hash`
    // and the `abilities` blob must never reach the client.
    return serialize(
      (rows as SessionRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        lastUsedAt: toIso(row.last_used_at),
        createdAt: toIso(row.created_at),
        expiresAt: toIso(row.expires_at),
        isCurrent: currentIdentifier !== undefined && String(currentIdentifier) === String(row.id),
      }))
    )
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.use('api').getUserOrFail()
    const currentIdentifier = user.currentAccessToken?.identifier

    const id = Number(params.id)
    if (!Number.isInteger(id)) {
      throw new NotFoundException('Session')
    }

    const row = await db
      .from(TOKENS_TABLE)
      .select('id', 'tokenable_id')
      .where('id', id)
      .where('type', TOKEN_TYPE)
      .first()

    // 404 and not 403 on a foreign token: a 403 would confirm the id exists.
    if (!row || Number(row.tokenable_id) !== Number(user.id)) {
      throw new NotFoundException('Session')
    }

    if (currentIdentifier !== undefined && String(currentIdentifier) === String(row.id)) {
      throw new ApiException(
        'E_CANNOT_REVOKE_CURRENT_SESSION',
        'Use the logout endpoint to end the current session',
        403
      )
    }

    await User.accessTokens.delete(user, id)

    return response.noContent()
  }
}
