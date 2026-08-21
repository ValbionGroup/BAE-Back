import UserTransformer from '#transformers/user_transformer'
import type { HttpContext } from '@adonisjs/core/http'
import { twoFactorStateOf } from '#services/two_factor_service'
import MemberTransformer from '#transformers/member_transformer'

export default class ProfileController {
  async show({ auth, serialize }: HttpContext) {
    const user = auth.use('api').getUserOrFail()
    await user.load('member', (query) =>
      query.preload('role', (roleQuery) => roleQuery.preload('permissions'))
    )

    if (user.member) user.member.$setRelated('user', user)

    return serialize({
      user: UserTransformer.transform(user, await twoFactorStateOf(user.id)),
      member: MemberTransformer.transform(user.member),
      permissions: user.member?.role?.permissions.map((entry) => entry.permission) ?? [],
    })
  }
}
