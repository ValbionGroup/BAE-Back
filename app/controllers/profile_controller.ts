import UserTransformer from '#transformers/user_transformer'
import type { HttpContext } from '@adonisjs/core/http'
import MemberTransformer from "#transformers/member_transformer";

export default class ProfileController {
  async show({ auth, serialize }: HttpContext) {
    const user = auth.use('api').getUserOrFail();
    await user.load('member', (query) => query.preload('role'))

    return serialize({
      user: UserTransformer.transform(user),
      member: MemberTransformer.transform(user.member)
    })
  }
}
