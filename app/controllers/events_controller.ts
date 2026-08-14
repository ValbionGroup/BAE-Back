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
  type RankedCandidate,
  clampPoints,
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
   * result. Re-running replaces prior algorithm-produced assignments (and
   * exactly reverses the points they awarded) but never touches manually
   * locked rows, which are excluded from the pool and never scored.
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
      const lockedMemberIds = new Set(lockedRows.map((row) => row.memberId))
      for (const row of lockedRows) {
        if (capacityByJob.has(row.jobId)) {
          capacityByJob.set(row.jobId, capacityByJob.get(row.jobId)! - 1)
        }
      }

      const respondingMembers = await event
        .related('members')
        .query()
        .useTransaction(trx)
        .wherePivot('is_available', true)
      const candidateMembers = respondingMembers.filter((member) => !lockedMemberIds.has(member.id))

      // A job with no `job_eligible_members` rows is unrestricted (open to
      // everyone) — only jobs with at least one row narrow the pool.
      const offeredJobs = await Job.query()
        .useTransaction(trx)
        .whereIn('id', [...capacityByJob.keys()])
        .preload('eligibleMembers')
      const eligibilityByJob = new Map<number, Set<number> | null>(
        offeredJobs.map((job) => [
          job.id,
          job.eligibleMembers.length > 0 ? new Set(job.eligibleMembers.map((m) => m.id)) : null,
        ])
      )

      const attendanceRows = await db
        .from('member_event_assigned_jobs')
        .select('member_id')
        .count('* as count')
        .groupBy('member_id')
        .useTransaction(trx)
      const attendanceByMember = new Map<number, number>(
        attendanceRows.map((row) => [Number(row.member_id), Number(row.count)])
      )

      const candidates: CandidateInput[] = []
      const rankedCandidates: RankedCandidate[] = []
      for (const member of candidateMembers) {
        const preferredJobs = await member.related('preferences').query().useTransaction(trx)
        const orderedJobIds = preferredJobs
          .slice()
          .sort((a, b) => Number(a.$extras.pivot_rank) - Number(b.$extras.pivot_rank))
          .filter((job) => capacityByJob.has(job.id))
          .filter((job) => {
            const eligibility = eligibilityByJob.get(job.id)
            return !eligibility || eligibility.has(member.id)
          })
          .map((job) => job.id)

        candidates.push({ memberId: member.id, orderedJobIds })
        rankedCandidates.push({
          memberId: member.id,
          points: member.points,
          historicalAttendanceCount: attendanceByMember.get(member.id) ?? 0,
        })
      }

      const jobRankingOrder = sortByJobRanking(rankedCandidates)
      const jobCapacities: JobCapacityInput[] = [...capacityByJob.entries()].map(
        ([jobId, remainingCount]) => ({ jobId, remainingCount: Math.max(0, remainingCount) })
      )

      const { matches, unmatchedMemberIds } = stableMatch(
        candidates,
        jobCapacities,
        jobRankingOrder
      )

      const priorRows = await MemberEventAssignedJob.query({ client: trx })
        .where('eventId', event.id)
        .where('locked', false)
      for (const row of priorRows) {
        const member = await Member.findOrFail(row.memberId, { client: trx })
        member.points = clampPoints(member.points - row.pointsDelta)
        await member.useTransaction(trx).save()
      }
      await MemberEventAssignedJob.query({ client: trx })
        .where('eventId', event.id)
        .where('locked', false)
        .delete()

      const persistedMatches = []
      for (const match of matches) {
        const member = await Member.findOrFail(match.memberId, { client: trx })
        const before = member.points
        member.points = clampPoints(before + computePointsDelta(match.rankAchieved))
        const appliedDelta = member.points - before
        await member.useTransaction(trx).save()
        await MemberEventAssignedJob.create(
          {
            memberId: match.memberId,
            eventId: event.id,
            jobId: match.jobId,
            locked: false,
            pointsDelta: appliedDelta,
          },
          { client: trx }
        )
        persistedMatches.push({ ...match, pointsDelta: appliedDelta })
      }

      return {
        matched: persistedMatches,
        unmatchedMemberIds,
        locked: lockedRows.map((row) => ({ memberId: row.memberId, jobId: row.jobId })),
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
