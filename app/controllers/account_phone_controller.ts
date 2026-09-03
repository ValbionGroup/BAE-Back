import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'
import ApiException from '#exceptions/api_exception'
import { updateAccountPhoneValidator } from '#validators/account_phone'
import { normalizePhone } from '#services/phone_number'

export default class AccountPhoneController {
  /**
   * Son propre numéro, sans passer par le bureau : `PATCH /members/:id` exige
   * `member:write`, que la plupart des caissiers n'ont pas — et Lydia refuse
   * d'encaisser sans numéro de caissier.
   */
  async update({ auth, request, serialize }: HttpContext) {
    const { phone } = await request.validateUsing(updateAccountPhoneValidator)
    const member = await Member.find(auth.getUserOrFail().id)

    if (member === null) {
      throw new ApiException('E_MEMBER_NOT_FOUND', "Ce compte n'a pas de fiche membre.", 404)
    }

    member.phone = phone === null || phone === '' ? null : normalizePhone(phone)
    await member.save()

    return serialize({ phone: member.phone })
  }
}
