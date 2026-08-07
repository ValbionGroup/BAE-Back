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
/**
 * The single wire shape of an assignment.
 *
 * `index` used to report `settled_at` while `store` and `update` did not, so a
 * client had to re-read the whole listing to learn whether the row it had just
 * written was already consolidated. One resource, one shape.
 */
function toWire(assignment: MemberEventAssignedJob) {
  return {
    memberId: assignment.memberId,
    eventId: assignment.eventId,
    jobId: assignment.jobId,
    locked: assignment.locked,
    pointsDelta: assignment.pointsDelta,
    settledAt: assignment.settledAt ? assignment.settledAt.toISO() : null,
  }
}

export default class AssignmentsController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    const assignments = await MemberEventAssignedJob.query()
      .orderBy('eventId')
      .orderBy('jobId')
      .orderBy('memberId')
    return serialize(assignments.map(toWire))
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
   *
   * The three structural rules below are checked here and nowhere else. The
   * matching engine enforces them by construction — it only ever proposes
   * offered jobs, to eligible members, one per period — so a hand-made row was
   * the one way around them. Harmless while every delta was 0; since §4.5 each
   * accepted row is worth up to +12, so skipping the checks means minting
   * credit.
   */
  async store({ request, response, serialize }: HttpContext) {
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
      return serialize(toWire(existing))
    }

    // 1. The evening has to offer the job at all. Without this an unoffered
    //    job is pure credit: it takes no slot from anybody, so nothing else in
    //    the system ever notices it.
    const offered = await db
      .from('event_jobs')
      .where('event_id', eventId)
      .where('job_id', jobId)
      .first()

    if (!offered) {
      return response.unprocessableEntity({
        error: {
          code: 'E_JOB_NOT_OFFERED',
          message: 'Ce poste n’est pas ouvert sur cette soirée.',
        },
      })
    }

    // 2. Eligibility, same convention as the engine: a job with no
    //    `job_eligible_members` row is unrestricted, one with at least one row
    //    is open only to the members listed.
    const eligibilityRows = await db.from('job_eligible_members').where('job_id', jobId)

    if (
      eligibilityRows.length > 0 &&
      !eligibilityRows.some((row) => Number(row.member_id) === memberId)
    ) {
      return response.unprocessableEntity({
        error: {
          code: 'E_MEMBER_NOT_ELIGIBLE',
          message: 'Ce membre n’est pas habilité à ce poste.',
        },
      })
    }

    // 3. At most one job per period per evening — the invariant the whole
    //    three-moments model rests on.
    const samePeriod = await MemberEventAssignedJob.query()
      .where('memberId', memberId)
      .where('eventId', eventId)
      .whereIn('jobId', (query) => query.from('jobs').select('id').where('type', job.type))
      .first()

    if (samePeriod) {
      return response.conflict({
        error: {
          code: 'E_PERIOD_ALREADY_ASSIGNED',
          message: 'Ce membre tient déjà un poste sur cette période.',
        },
      })
    }

    const preference = await db
      .from('member_job_preferences')
      .where('member_id', memberId)
      .where('job_id', jobId)
      .first()
    const rankAchieved = preference ? Number(preference.rank) : null
    const pointsDelta = computePointsDelta(job.type as JobPeriod, rankAchieved)

    const created = await MemberEventAssignedJob.create({
      memberId,
      eventId,
      jobId,
      locked: locked ?? false,
      pointsDelta,
    })

    return serialize(toWire(created))
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

    assignment.locked = locked
    return serialize(toWire(assignment))
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
