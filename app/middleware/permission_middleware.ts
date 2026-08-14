import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiException from '#exceptions/api_exception'
import Member from '#models/member'

/**
 * Authorises a route against a named permission.
 *
 * Until now the only gate in the app was `middleware.auth()`, which proves who
 * you are and nothing more — so any authenticated member could read every
 * endpoint, `GET /v1/logs` included.
 *
 * The permission chain is already modelled in the database and is simply
 * resolved here:
 *
 *     user → member (shared primary key) → role → roles_permissions → permission
 *
 * `Member` uses `selfAssignPrimaryKey` with `belongsTo(User, { foreignKey: 'id' })`,
 * so a user's member row is the one carrying the same id.
 *
 * Denials are deliberately coarse — a user with no member row, no role, or a
 * role lacking the permission all get the same 403. Distinguishing them would
 * leak the shape of the permission model to callers who may not have any.
 *
 * Usage:
 *     router.get('/logs', [controllers.Logs, 'index']).use(middleware.can('log:read'))
 */
export default class PermissionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, permission: string | string[]) {
    const required = Array.isArray(permission) ? permission : [permission]
    const user = ctx.auth.getUserOrFail()

    const member = await Member.query()
      .where('id', user.id)
      .preload('role', (roleQuery) => roleQuery.preload('permissions'))
      .first()

    const granted = new Set(member?.role?.permissions.map((entry) => entry.permission) ?? [])
    const missing = required.filter((entry) => !granted.has(entry))

    if (missing.length > 0) {
      // `ApiException` et non une `Exception` nue : le gestionnaire d'erreurs ne
      // traite spécialement que la première. Une exception nue tombe dans le
      // fourre-tout, qui conserve le statut mais remplace le corps par
      // `E_INTERNAL_SERVER_ERROR` et « Internal server error » hors mode debug —
      // le client n'apprendrait donc pas quelle permission lui manque.
      throw new ApiException('E_FORBIDDEN', `Missing permission: ${missing.join(', ')}`, 403)
    }

    return next()
  }
}
