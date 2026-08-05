import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import ApiException from '#exceptions/api_exception'
import NotFoundException from '#exceptions/not_found_exception'

/**
 * Table and token bucket used by the `api` guard (see `config/auth.ts` and
 * `DbAccessTokensProvider` defaults).
 */
const TOKENS_TABLE = 'auth_access_tokens'
const TOKEN_TYPE = 'auth_token'

/**
 * Shape of the raw rows read from `auth_access_tokens`. Only the columns that
 * may be exposed are selected — `hash` and `abilities` are never read.
 */
interface SessionRow {
  id: number
  name: string | null
  ip_address: string | null
  user_agent: string | null
  last_used_at: Date | string | null
  created_at: Date | string | null
  expires_at: Date | string | null
}

/**
 * Normalises a driver timestamp (JS `Date` on pg/mysql) to an ISO 8601 string,
 * the format the frontend types its date fields with.
 */
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
  /**
   * List the active access tokens (sessions) of the authenticated user.
   *
   * The payload is built explicitly — the model/row is never spread — so the
   * token `hash` and the `abilities` blob can never leak to the client.
   */
  async index({ auth, serialize }: HttpContext) {
    const user = auth.use('api').getUserOrFail()
    const currentIdentifier = user.currentAccessToken?.identifier

    const rows = await db
      .from(TOKENS_TABLE)
      .select('id', 'name', 'ip_address', 'user_agent', 'last_used_at', 'created_at', 'expires_at')
      .where('tokenable_id', user.id)
      .where('type', TOKEN_TYPE)
      .orderBy('created_at', 'desc')

    return serialize(
      (rows as SessionRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        ipAddress: row.ip_address,
        // Raw UA string on purpose: the frontend parses it into a device label.
        userAgent: row.user_agent,
        lastUsedAt: toIso(row.last_used_at),
        createdAt: toIso(row.created_at),
        expiresAt: toIso(row.expires_at),
        isCurrent: currentIdentifier !== undefined && String(currentIdentifier) === String(row.id),
      }))
    )
  }

  /**
   * Revoke one session of the authenticated user.
   *
   * Revoking the *current* session is refused: ending it is a logout and must
   * go through `POST /v1/auth/logout` so the client also clears its local
   * credentials instead of silently losing them.
   */
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

    /**
     * Ownership guard: a user may only revoke their own tokens. Answering 404
     * (rather than 403) on a foreign token avoids confirming that the id
     * exists at all.
     */
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
