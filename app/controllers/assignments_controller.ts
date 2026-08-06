import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import Job from '#models/job'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { assignmentLockValidator, assignmentValidator } from '#validators/coordination'

/**
 * Assignments are the `member_event_assigned_jobs` rows: which member holds
 * which job on which event. The composite key has no surrogate id, so `update`
 * and `destroy` read it from the query string.
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
      locked: assignment.locked,
      pointsDelta: assignment.pointsDelta,
    }))
    return serialize(rows)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { memberId, eventId, jobId, locked } = await request.validateUsing(assignmentValidator)
    await Member.findOrFail(memberId)
    await Event.findOrFail(eventId)
    await Job.findOrFail(jobId)

    const existing = await MemberEventAssignedJob.query()
      .where('memberId', memberId)
      .where('eventId', eventId)
      .where('jobId', jobId)
      .first()

    if (!existing) {
      await MemberEventAssignedJob.create({ memberId, eventId, jobId, locked: locked ?? false })
    }

    return serialize({ memberId, eventId, jobId, locked: locked ?? false })
  }

  /**
   * Update an existing assignment in place. Only `locked` is mutable.
   *
   * Without this, a client could only toggle the lock by deleting the row and
   * recreating it — which silently reset `points_delta`, the value the matching
   * engine refunds when it replaces a row.
   */
  async update({ request, response, serialize }: HttpContext) {
    const { memberId, eventId, jobId } = await assignmentValidator.validate(request.qs())
    const { locked } = await request.validateUsing(assignmentLockValidator)

    const assignment = await MemberEventAssignedJob.query()
      .where('memberId', memberId)
      .where('eventId', eventId)
      .where('jobId', jobId)
      .first()

    if (!assignment) {
      return response.notFound({
        error: { code: 'E_ROW_NOT_FOUND', message: 'Assignment not found' },
      })
    }

    assignment.locked = locked
    await assignment.save()

    return serialize({
      memberId: assignment.memberId,
      eventId: assignment.eventId,
      jobId: assignment.jobId,
      locked: assignment.locked,
      pointsDelta: assignment.pointsDelta,
    })
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
