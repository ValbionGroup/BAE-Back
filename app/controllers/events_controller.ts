import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import Job from '#models/job'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { availabilityValidator } from '#validators/event'
import {
  type CandidateInput,
  type JobCapacityInput,
  type JobPeriod,
  type RankedCandidate,
  JOB_PERIODS,
  buildEffectivePreferences,
  computePointsDelta,
  sortByJobRanking,
  stableMatch,
} from '#services/matching_service'

export default class EventsController {
  async index({ serialize }: HttpContext) {
    return serialize(await Event.query())
  }

  async store({ request, serialize }: HttpContext) {
    const { name, date, duration, description, status } = request.all()
    const event = new Event()
    event.name = name
    event.date = date
    event.duration = duration
    event.description = description
    event.status = status
    await event.save()
    return serialize(event)
  }

  async show({ params, serialize }: HttpContext) {
    const event = await Event.query().where('id', params.id).firstOrFail()
    return serialize(event)
  }

  async update({ params, request, serialize }: HttpContext) {
    const event = await Event.query().where('id', params.id).firstOrFail()
    const { name, date, duration, description, status } = request.all()
    event.name = name
    event.date = date
    event.duration = duration
    event.description = description
    event.status = status
    await event.save()
    return serialize(event)
  }

  /**
   * Deletes an evening — unless its points were consolidated.
   *
   * `members.points` is a DERIVED total (D7): the sum of the settled
   * `points_delta`, which is exactly what `points:recompute` rebuilds. While
   * the assignment FKs cascaded, deleting an evening erased the rows without
   * touching `members.points` — the total survived until the next recompute,
   * which then wiped a credit that had genuinely been earned. So the ledger of
   * a closed evening is not deletable; `node ace event:unsettle` hands the
   * credit back first, knowingly, and then this passes.
   *
   * The UNSETTLED rows are deleted here by hand because the FK is now
   * `RESTRICT`: their delta never reached anybody's total, so there is nothing
   * to give back and nothing to preserve.
   */
  async destroy({ params, response }: HttpContext) {
    const event = await Event.query().where('id', params.id).firstOrFail()

    await db.transaction(async (trx) => {
      const settled = await MemberEventAssignedJob.query({ client: trx })
        .where('eventId', event.id)
        .whereNotNull('settledAt')
        .first()

      if (settled) {
        response.conflict({
          error: {
            code: 'E_EVENT_SETTLED',
            message: 'Soirée déjà consolidée. Déclôturez-la avant de la supprimer.',
          },
        })
        return
      }

      await MemberEventAssignedJob.query({ client: trx }).where('eventId', event.id).delete()
      await event.useTransaction(trx).delete()
    })
  }

  async getResponse({ params, auth }: HttpContext) {
    const user = auth.use('api').getUserOrFail()
    await Event.findOrFail(params.id)
    const row = await db
      .from('member_responses')
      .where('member_id', user.id)
      .where('event_id', params.id)
      .first()
    const status = row ? (row.is_available ? 1 : 0) : -1
    return { data: status }
  }

  /**
   * Sets the authenticated member's own availability for an event.
   *
   * Declaring oneself absent is refused once the member holds at least one
   * job on this evening — any period, D9 — because `AssignmentsController`
   * does not read this table when assigning, so a lock is the only place the
   * rule can be enforced. Confirming presence is always allowed (D8): a
   * manual assignment may target a member who had said no, and that member
   * needs a way back to "available" rather than being stuck as "assigned and
   * absent".
   */
  async setResponse({ params, request, response, auth }: HttpContext) {
    const user = auth.use('api').getUserOrFail()
    const { isAvailable } = await request.validateUsing(availabilityValidator)
    await Event.findOrFail(params.id)
    const member = await Member.findOrFail(user.id)

    if (!isAvailable) {
      const hasAssignment = await MemberEventAssignedJob.query()
        .where('memberId', member.id)
        .where('eventId', params.id)
        .first()

      if (hasAssignment) {
        return response.conflict({
          error: {
            code: 'E_PRESENCE_LOCKED_BY_ASSIGNMENT',
            message:
              'Vous tenez un poste sur cette soirée. Demandez au bureau ou au coordinateur de vous en retirer avant de vous déclarer absent·e.',
          },
        })
      }
    }

    await member.related('responses').sync({ [params.id]: { is_available: isAvailable } }, false)
    return { data: isAvailable ? 1 : 0 }
  }

  /**
   * Runs the stable-marriage job matching for this event and persists the
   * result — one pass per period, so a member can hold a `before`, a `during`
   * and an `after` job on the same evening (D1).
   *
   * Re-running replaces prior algorithm-produced assignments but never touches
   * manually locked rows: a lock only reserves its job's capacity and pulls the
   * member out of the pool *for that job's period* (D9 concerns the evening,
   * the matching pool does not).
   *
   * `members.points` is never written here (D7): each delta lives on its
   * assignment row until the evening is closed.
   */
  async runMatching({ params, response, serialize }: HttpContext) {
    const event = await Event.findOrFail(params.id)

    const summary = await db.transaction(async (trx) => {
      // Every assignment row of the event, locked `FOR UPDATE` for the whole
      // transaction. The lock is what makes the settled check below a real
      // guard: without it a `settle` could consolidate a row between the check
      // and the deletion at the end, and that credit would become
      // unrefundable — the row carrying it would be gone.
      const existingRows = await MemberEventAssignedJob.query({ client: trx })
        .where('eventId', event.id)
        .forUpdate()

      // A re-run deletes every unlocked row. Once a delta has been consolidated
      // into `members.points`, deleting its row would erase the only trace of a
      // credit already granted.
      if (existingRows.some((row) => row.settledAt !== null)) {
        return null
      }

      const jobRows = await event.related('jobs').query().useTransaction(trx)
      const capacityByJob = new Map<number, number>(
        jobRows.map((job) => [job.id, Number(job.$extras.pivot_count)])
      )

      const lockedRows = existingRows.filter((row) => row.locked)

      // Locked rows may point at a job the event no longer offers, so the
      // period lookup covers their jobs too — the response reports it.
      const periodJobIds = new Set<number>([
        ...capacityByJob.keys(),
        ...lockedRows.map((row) => row.jobId),
      ])
      const jobDetails = await Job.query()
        .useTransaction(trx)
        .whereIn('id', [...periodJobIds])
        .preload('eligibleMembers')
      const periodByJob = new Map<number, JobPeriod>(
        jobDetails.map((job) => [job.id, job.type as JobPeriod])
      )

      const lockedMemberIdsByPeriod = new Map<JobPeriod, Set<number>>(
        JOB_PERIODS.map((period) => [period, new Set<number>()])
      )
      const lockedMemberIds = new Set(lockedRows.map((row) => row.memberId))
      for (const row of lockedRows) {
        if (capacityByJob.has(row.jobId)) {
          capacityByJob.set(row.jobId, capacityByJob.get(row.jobId)! - 1)
        }
        const period = periodByJob.get(row.jobId)
        if (period) {
          lockedMemberIdsByPeriod.get(period)!.add(row.memberId)
        }
      }

      // One pool for the whole evening: `member_responses.is_available` is a
      // single boolean, and that is deliberate — saying yes means being
      // available for all three moments.
      const respondingMembers = await event
        .related('members')
        .query()
        .useTransaction(trx)
        .wherePivot('is_available', true)

      // A job with no `job_eligible_members` rows is unrestricted (open to
      // everyone) — only jobs with at least one row narrow the pool.
      const eligibilityByJob = new Map<number, Set<number> | null>(
        jobDetails.map((job) => [
          job.id,
          job.eligibleMembers.length > 0 ? new Set(job.eligibleMembers.map((m) => m.id)) : null,
        ])
      )

      // Attendance history means *other* evenings: counting this event's own
      // rows would make a second run rank people differently from the first.
      //
      // `countDistinct` on the event, never `count('*')`: since D1 one evening
      // yields up to three rows for the same member (before/during/after), and
      // `rankingKey` divides points by *evenings worked*. Counting rows would
      // rank somebody who covered all three periods of a single evening below
      // somebody who did one `during` on two evenings — penalising precisely
      // the thankless shifts the D5 credits reward, and which the member does
      // not even choose to take on.
      //
      // SETTLED evenings only. `rankingKey` divides points by evenings worked,
      // and since D7 the numerator moves at the close and nowhere else — so an
      // evening counted in the denominator before its close removes priority
      // for work the member has not been credited for yet. The heavier the
      // shift, the worse the penalty: exactly backwards. `whereNotNull` puts
      // the two halves of the ratio back in step.
      const attendanceRows = await db
        .from('member_event_assigned_jobs')
        .select('member_id')
        .whereNot('event_id', event.id)
        .whereNotNull('settled_at')
        .countDistinct('event_id as count')
        .groupBy('member_id')
        .useTransaction(trx)
      const attendanceByMember = new Map<number, number>(
        attendanceRows.map((row) => [Number(row.member_id), Number(row.count)])
      )

      // The expressed ranking is global and loaded once: it is restricted to
      // the jobs of a period at proposal time, never re-numbered (D3).
      const expressedRankByMember = new Map<number, Record<number, number>>()
      const rankedCandidates: RankedCandidate[] = []
      for (const member of respondingMembers) {
        const preferredJobs = await member.related('preferences').query().useTransaction(trx)
        const expressedRankByJobId: Record<number, number> = {}
        for (const job of preferredJobs) {
          expressedRankByJobId[job.id] = Number(job.$extras.pivot_rank)
        }
        expressedRankByMember.set(member.id, expressedRankByJobId)
        rankedCandidates.push({
          memberId: member.id,
          points: member.points,
          historicalAttendanceCount: attendanceByMember.get(member.id) ?? 0,
        })
      }

      const jobRankingOrder = sortByJobRanking(rankedCandidates)

      const matched: {
        memberId: number
        jobId: number
        period: JobPeriod
        rankAchieved: number | null
        pointsDelta: number
      }[] = []
      const matchedMemberIds = new Set<number>()

      for (const period of JOB_PERIODS) {
        const jobIdsOfPeriod = [...capacityByJob.keys()].filter(
          (jobId) => periodByJob.get(jobId) === period
        )
        if (jobIdsOfPeriod.length === 0) {
          continue
        }

        const lockedForPeriod = lockedMemberIdsByPeriod.get(period)!
        const candidates: CandidateInput[] = []
        for (const member of respondingMembers) {
          if (lockedForPeriod.has(member.id)) {
            continue
          }
          const eligibleJobIds = jobIdsOfPeriod.filter((jobId) => {
            const eligibility = eligibilityByJob.get(jobId)
            return !eligibility || eligibility.has(member.id)
          })
          const expressedRankByJobId = expressedRankByMember.get(member.id) ?? {}
          candidates.push({
            memberId: member.id,
            orderedJobIds: buildEffectivePreferences(expressedRankByJobId, eligibleJobIds),
            expressedRankByJobId,
          })
        }

        const jobCapacities: JobCapacityInput[] = jobIdsOfPeriod.map((jobId) => ({
          jobId,
          remainingCount: Math.max(0, capacityByJob.get(jobId)!),
        }))

        const { matches } = stableMatch(candidates, jobCapacities, jobRankingOrder)
        for (const match of matches) {
          matched.push({
            ...match,
            period,
            pointsDelta: computePointsDelta(period, match.rankAchieved),
          })
          matchedMemberIds.add(match.memberId)
        }
      }

      // Being passed over on one period is not "unassigned": only a member who
      // ends the evening with nothing at all — no match, no lock — counts.
      const unmatchedMemberIds = respondingMembers
        .map((member) => member.id)
        .filter((memberId) => !matchedMemberIds.has(memberId) && !lockedMemberIds.has(memberId))
        .sort((a, b) => a - b)

      // No refund: the deltas never reached `members.points` in the first
      // place, they are consolidated when the evening is closed (D7).
      await MemberEventAssignedJob.query({ client: trx })
        .where('eventId', event.id)
        .where('locked', false)
        .delete()

      for (const match of matched) {
        await MemberEventAssignedJob.create(
          {
            memberId: match.memberId,
            eventId: event.id,
            jobId: match.jobId,
            locked: false,
            pointsDelta: match.pointsDelta,
          },
          { client: trx }
        )
      }

      return {
        matched,
        unmatchedMemberIds,
        locked: lockedRows.map((row) => ({
          memberId: row.memberId,
          jobId: row.jobId,
          period: periodByJob.get(row.jobId) ?? null,
        })),
      }
    })

    if (summary === null) {
      return response.conflict({
        error: {
          code: 'E_EVENT_ALREADY_SETTLED',
          message:
            "Les points de cette soirée ont déjà été consolidés : relancer l'affectation fausserait les scores.",
        },
      })
    }

    return serialize(summary)
  }

  /**
   * Closes the evening: consolidates every pending `points_delta` of the event
   * into `members.points` (D7).
   *
   * Idempotent row by row. The claim is a single `UPDATE … WHERE settled_at IS
   * NULL … RETURNING`, so it is also the lock: a concurrent close blocks on the
   * same rows, then re-evaluates the predicate and finds nothing left to claim.
   * Reading the rows first and updating them afterwards would let two calls
   * read the same pending set and apply it twice.
   */
  async settle({ params, serialize }: HttpContext) {
    const event = await Event.findOrFail(params.id)

    const summary = await db.transaction(async (trx) => {
      const claimed = await trx
        .from('member_event_assigned_jobs')
        .where('event_id', event.id)
        .whereNull('settled_at')
        .update({ settled_at: DateTime.now().toJSDate() }, ['member_id', 'points_delta'])

      const deltaByMember = new Map<number, number>()
      let totalDelta = 0
      for (const row of claimed) {
        const memberId = Number(row.member_id)
        const delta = Number(row.points_delta)
        deltaByMember.set(memberId, (deltaByMember.get(memberId) ?? 0) + delta)
        totalDelta += delta
      }

      // `increment` with a negative amount is the refund direction: a member
      // who was served his first choice legitimately spends credit (D6, the
      // score may go negative).
      for (const [memberId, delta] of deltaByMember) {
        if (delta !== 0) {
          await trx.from('members').where('id', memberId).increment('points', delta)
        }
      }

      // Counted after the claim so that a close racing another one reports the
      // rows the winner just consolidated, instead of an empty snapshot.
      const settledTotal = await trx
        .from('member_event_assigned_jobs')
        .where('event_id', event.id)
        .whereNotNull('settled_at')
        .count('* as total')
        .first()

      return {
        settled: claimed.length,
        alreadySettled: Math.max(0, Number(settledTotal?.total ?? 0) - claimed.length),
        totalDelta,
      }
    })

    return serialize(summary)
  }

  async roster({ params, serialize }: HttpContext) {
    await Event.findOrFail(params.id)
    const members = await Member.query().preload('responses', (q) =>
      q.where('events.id', params.id)
    )
    const roster = members.map((m) => {
      const response = m.responses[0]
      const status = response ? (response.$extras.pivot_is_available ? 1 : 0) : -1
      return { id: m.id, name: `${m.firstName} ${m.lastName}`, status }
    })
    return serialize(roster)
  }
}
