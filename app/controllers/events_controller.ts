import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import Job from '#models/job'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import db from '@adonisjs/lucid/services/db'
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

  async destroy({ params }: HttpContext) {
    const event = await Event.query().where('id', params.id).firstOrFail()
    await event.delete()
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

  async setResponse({ params, request, auth }: HttpContext) {
    const user = auth.use('api').getUserOrFail()
    const { isAvailable } = await request.validateUsing(availabilityValidator)
    await Event.findOrFail(params.id)
    const member = await Member.findOrFail(user.id)
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
  async runMatching({ params, serialize }: HttpContext) {
    const event = await Event.findOrFail(params.id)

    const summary = await db.transaction(async (trx) => {
      const jobRows = await event.related('jobs').query().useTransaction(trx)
      const capacityByJob = new Map<number, number>(
        jobRows.map((job) => [job.id, Number(job.$extras.pivot_count)])
      )

      const lockedRows = await MemberEventAssignedJob.query({ client: trx })
        .where('eventId', event.id)
        .where('locked', true)

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
      const attendanceRows = await db
        .from('member_event_assigned_jobs')
        .select('member_id')
        .whereNot('event_id', event.id)
        .count('* as count')
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
