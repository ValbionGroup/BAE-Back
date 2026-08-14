import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'

export default class ResponsesController {
  async index({ serialize }: HttpContext) {
    const members = await Member.query().preload('responses').orderBy('id')
    const responses = members.flatMap((member) =>
      member.responses.map((event) => ({
        memberId: member.id,
        eventId: event.id,
        isAvailable: Boolean(event.$extras.pivot_is_available),
      }))
    )
    return serialize(responses)
  }
}
