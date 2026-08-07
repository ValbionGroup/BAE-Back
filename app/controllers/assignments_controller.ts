import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import Job from '#models/job'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import db from '@adonisjs/lucid/services/db'
import { assignmentLockValidator, assignmentValidator } from '#validators/coordination'
import { type JobPeriod, computePointsDelta } from '#services/matching_service'

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
      settledAt: assignment.settledAt ? assignment.settledAt.toISO() : null,
    }))
    return serialize(rows)
  }

  /**
   * Create an assignment, or leave the existing one untouched.
   *
   * The row is credited exactly like the matching engine would credit it:
   * `CHARGE(période) − coûtRang(rang exprimé)`, the expressed rank being read
   * from `member_job_preferences` (null when the member never ranked the job).
   * Scoring a hand-made assignment at 0 would mean holding a job for free —
   * and would reward working around the engine.
   *
   * Create-or-IGNORE, not upsert: an existing row keeps its delta, whatever the
   * member's ranking has become since, and a settled row is never rewritten.
   */
  async store({ request, serialize }: HttpContext) {
    const { memberId, eventId, jobId, locked } = await request.validateUsing(assignmentValidator)
    await Member.findOrFail(memberId)
    await Event.findOrFail(eventId)
    const job = await Job.findOrFail(jobId)

    const existing = await MemberEventAssignedJob.query()
      .where('memberId', memberId)
      .where('eventId', eventId)
      .where('jobId', jobId)
      .first()

    if (existing) {
      return serialize({
        memberId: existing.memberId,
        eventId: existing.eventId,
        jobId: existing.jobId,
        locked: existing.locked,
        pointsDelta: existing.pointsDelta,
      })
    }

    const preference = await db
      .from('member_job_preferences')
      .where('member_id', memberId)
      .where('job_id', jobId)
      .first()
    const rankAchieved = preference ? Number(preference.rank) : null
    const pointsDelta = computePointsDelta(job.type as JobPeriod, rankAchieved)

    await MemberEventAssignedJob.create({
      memberId,
      eventId,
      jobId,
      locked: locked ?? false,
      pointsDelta,
    })

    return serialize({ memberId, eventId, jobId, locked: locked ?? false, pointsDelta })
  }

  /**
   * Update an existing assignment in place. Only `locked` is mutable.
   *
   * Without this, a client could only toggle the lock by deleting the row and
   * recreating it — which silently reset `points_delta`, the value the matching
   * engine refunds when it replaces a row.
   *
   * Same trap as `destroy`: the real primary key is composite, but the
   * generated schema only marks `member_id` as primary, so `assignment.save()`
   * emits `UPDATE … WHERE member_id = ?` and locks EVERY row of that member,
   * across every evening. A row locked by accident then survives the
   * `.where('locked', false).delete()` of a re-run — the engine can no longer
   * replace it and its capacity stays reserved. Hence the explicit builder.
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

    await MemberEventAssignedJob.query()
      .where('memberId', memberId)
      .where('eventId', eventId)
      .where('jobId', jobId)
      .update({ locked })

    return serialize({
      memberId: assignment.memberId,
      eventId: assignment.eventId,
      jobId: assignment.jobId,
      locked,
      pointsDelta: assignment.pointsDelta,
    })
  }

  /**
   * Delete an assignment, giving back the credit it had been granted.
   *
   * Only a SETTLED row has anything to refund: an unsettled delta never
   * reached `members.points`. Reading the row before deleting it is the whole
   * point — the previous blind `delete()` left the credit of a closed evening
   * on a member who no longer holds the job.
   *
   * `forUpdate` closes the window against a concurrent `settle`: without it,
   * the close could consolidate the row between our read and our delete, and
   * the credit would survive its own assignment.
   */
  async destroy({ request, response }: HttpContext) {
    const { memberId, eventId, jobId } = await assignmentValidator.validate(request.qs())

    await db.transaction(async (trx) => {
      const assignment = await MemberEventAssignedJob.query({ client: trx })
        .where('memberId', memberId)
        .where('eventId', eventId)
        .where('jobId', jobId)
        .forUpdate()
        .first()

      if (!assignment) {
        return
      }

      if (assignment.settledAt !== null && assignment.pointsDelta !== 0) {
        await trx.from('members').where('id', memberId).decrement('points', assignment.pointsDelta)
      }

      // Explicit query builder: the real primary key is composite, and
      // `assignment.delete()` would only key on `member_id`.
      await MemberEventAssignedJob.query({ client: trx })
        .where('memberId', memberId)
        .where('eventId', eventId)
        .where('jobId', jobId)
        .delete()
    })

    return response.noContent()
  }
}
