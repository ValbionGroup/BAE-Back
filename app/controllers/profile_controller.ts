import UserTransformer from '#transformers/user_transformer'
import type { HttpContext } from '@adonisjs/core/http'
import { twoFactorStateOf } from '#services/two_factor_service'
import MemberTransformer from '#transformers/member_transformer'
import ClientProfileTransformer from '#transformers/client_profile_transformer'
import Client from '#models/client'
import ApiException from '#exceptions/api_exception'
import { updateProfileValidator } from '#validators/profile'

export default class ProfileController {
  /** `client` vaut `null` pour un compte sans ligne `clients` : cas courant, pas une erreur. */
  async show({ auth, serialize }: HttpContext) {
    const user = auth.use('api').getUserOrFail()
    await user.load('member', (query) =>
      query.preload('role', (roleQuery) => roleQuery.preload('permissions'))
    )

    if (user.member) user.member.$setRelated('user', user)

    const client = await Client.find(user.id)

    return serialize({
      user: UserTransformer.transform(user, await twoFactorStateOf(user.id)),
      member: MemberTransformer.transform(user.member),
      permissions: user.member?.role?.permissions.map((entry) => entry.permission) ?? [],
      client: client === null ? null : ClientProfileTransformer.transform(client),
    })
  }

  /**
   * `'x' in payload` distingue « efface » (`null`) de « ne touche pas » (clé absente).
   * La ligne existe : `audience('client')` l'a déjà résolue.
   */
  async update({ auth, request, serialize }: HttpContext) {
    const payload = await request.validateUsing(updateProfileValidator)
    const user = auth.getUserOrFail()
    const client = await Client.find(user.id)

    if (client === null) {
      throw new ApiException('E_CLIENT_NOT_FOUND', "Ce compte n'a pas de profil client.", 404)
    }

    if ('phone' in payload) client.phone = blankToNull(payload.phone)
    if ('preparationNote' in payload) client.preparationNote = blankToNull(payload.preparationNote)
    if ('telegramHandle' in payload) {
      const handle = blankToNull(payload.telegramHandle)
      client.telegramHandle = handle === null ? null : handle.replace(/^@/, '')
    }

    await client.save()

    return serialize(ClientProfileTransformer.transform(client))
  }
}

/** Un champ vidé arrive en `''` : c'est un effacement. */
function blankToNull(value: string | null | undefined): string | null {
  return value === null || value === undefined || value === '' ? null : value
}
