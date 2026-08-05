import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import Job from '#models/job'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { assignmentValidator } from '#validators/coordination'

/**
 * Assignments are the `member_event_assigned_jobs` rows: which member holds
 * which job on which event. The composite key has no surrogate id, so `destroy`
 * reads it from the query string.
 */
export default class AssignmentsController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    const assignments = await MemberEventAssignedJob.query()
      .orderBy('eventId')
      .orderBy('jobId')
      .orderBy('memberId')
    const rows = assignments.map((assignment) => ({
      memberId: assignment.memberId,
      eventId: assignment.eventId,
      jobId: assignment.jobId,
    }))
    return serialize(rows)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { memberId, eventId, jobId } = await request.validateUsing(assignmentValidator)
    await Member.findOrFail(memberId)
    await Event.findOrFail(eventId)
    await Job.findOrFail(jobId)

    const existing = await MemberEventAssignedJob.query()
      .where('memberId', memberId)
      .where('eventId', eventId)
      .where('jobId', jobId)
      .first()

    if (!existing) {
      await MemberEventAssignedJob.create({ memberId, eventId, jobId })
    }

    return serialize({ memberId, eventId, jobId })
  }

  /**
   * Delete record
   */
  async destroy({ request, response }: HttpContext) {
    const { memberId, eventId, jobId } = await assignmentValidator.validate(request.qs())
    await MemberEventAssignedJob.query()
      .where('memberId', memberId)
      .where('eventId', eventId)
      .where('jobId', jobId)
      .delete()
    return response.noContent()
  }
}
