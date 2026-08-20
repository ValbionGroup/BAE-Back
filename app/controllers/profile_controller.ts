import UserTransformer from '#transformers/user_transformer'
import type { HttpContext } from '@adonisjs/core/http'
import MemberTransformer from '#transformers/member_transformer'

export default class ProfileController {
  async show({ auth, serialize }: HttpContext) {
    const user = auth.use('api').getUserOrFail()
    await user.load('member', (query) =>
      query.preload('role', (roleQuery) => roleQuery.preload('permissions'))
    )

    // `MemberTransformer` lit le nom sur `member.user` depuis que l'identité a
    // quitté `members`. Le compte est déjà en main : le rattacher évite d'aller
    // relire la même ligne, et sans lui le profil répond « null null ».
    if (user.member) user.member.$setRelated('user', user)

    return serialize({
      user: UserTransformer.transform(user),
      member: MemberTransformer.transform(user.member),
      permissions: user.member?.role?.permissions.map((entry) => entry.permission) ?? [],
    })
  }
}
