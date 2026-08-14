import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiException from '#exceptions/api_exception'
import Member from '#models/member'

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

    // `ApiException` and not a bare `Exception`: the error handler only treats
    // the former specially, a bare one has its body replaced by
    // `E_INTERNAL_SERVER_ERROR` outside debug mode.
    if (missing.length > 0) {
      throw new ApiException('E_FORBIDDEN', `Missing permission: ${missing.join(', ')}`, 403)
    }

    return next()
  }
}
