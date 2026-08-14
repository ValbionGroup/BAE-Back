import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'

/**
 * Global read-only index over `member_responses`: the availability every member
 * declared on every event. Per-event writes live on `EventsController`
 * (`/events/:id/response`).
 */
export default class ResponsesController {
  /**
   * Display a list of resource
   */
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
