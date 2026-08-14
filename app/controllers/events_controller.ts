import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import Job from '#models/job'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { availabilityValidator } from '#validators/event'
import {
  type BackfillJobInput,
  type CandidateInput,
  type JobCapacityInput,
  type JobPeriod,
  type RankedCandidate,
  JOB_PERIODS,
  backfillUnmatched,
  buildEffectivePreferences,
  computePointsDelta,
  makeTieBreaker,
  seededRng,
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

  async destroy({ params, response }: HttpContext) {
    const event = await Event.query().where('id', params.id).firstOrFail()

    // `members.points` is a DERIVED total: the sum of the settled `points_delta`,
    // which `points:recompute` rebuilds. A settled row therefore may not vanish,
    // or the next recompute would wipe a credit that had genuinely been earned.
    // `node ace event:unsettle` is the way through.
    await db.transaction(async (trx) => {
      const settled = await MemberEventAssignedJob.query({ client: trx })
        .where('eventId', event.id)
        .whereNotNull('settledAt')
        .first()

      if (settled) {
        response.conflict({
          error: {
            code: 'E_EVENT_SETTLED',
            message: 'Soirée déjà consolidée : déclôturez-la d’abord.',
          },
        })
        return
      }

      await MemberEventAssignedJob.query({ client: trx })
        .where('eventId', event.id)
        .whereNull('settledAt')
        .delete()
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
            message: 'Vous tenez un poste sur cette soirée : voyez le bureau pour vous désengager.',
          },
        })
      }
    }

    await member.related('responses').sync({ [params.id]: { is_available: isAvailable } }, false)
    return { data: isAvailable ? 1 : 0 }
  }

  async runMatching({ params, response, serialize }: HttpContext) {
    const event = await Event.findOrFail(params.id)

    const summary = await db.transaction(async (trx) => {
      const existingRows = await MemberEventAssignedJob.query({ client: trx })
        .where('eventId', event.id)
        .forUpdate()

      if (existingRows.some((row) => row.settledAt !== null)) {
        return null
      }

      const jobRows = await event.related('jobs').query().useTransaction(trx)
      const capacityByJob = new Map<number, number>(
        jobRows.map((job) => [job.id, Number(job.$extras.pivot_count)])
      )

      const lockedRows = existingRows.filter((row) => row.locked)

      const periodJobIds = new Set<number>([
        ...capacityByJob.keys(),
        ...lockedRows.map((row) => row.jobId),
      ])
      const jobDetails = await Job.query({ client: trx })
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

      const respondingMembers = await event
        .related('members')
        .query()
        .useTransaction(trx)
        .wherePivot('is_available', true)

      const eligibilityByJob = new Map<number, Set<number> | null>(
        jobDetails.map((job) => [
          job.id,
          job.eligibleMembers.length > 0 ? new Set(job.eligibleMembers.map((m) => m.id)) : null,
        ])
      )

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

      const memberTieBreak = makeTieBreaker(
        respondingMembers.map((member) => member.id),
        seededRng(event.id)
      )
      const jobRankingOrder = sortByJobRanking(rankedCandidates, memberTieBreak)

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

      const zeroAssignmentMemberIds = respondingMembers
        .map((member) => member.id)
        .filter((memberId) => !matchedMemberIds.has(memberId) && !lockedMemberIds.has(memberId))

      if (zeroAssignmentMemberIds.length > 0) {
        const takenByJob = new Map<number, number>()
        for (const match of matched) {
          takenByJob.set(match.jobId, (takenByJob.get(match.jobId) ?? 0) + 1)
        }

        const backfillJobs: BackfillJobInput[] = []
        for (const [jobId, capacity] of capacityByJob) {
          const period = periodByJob.get(jobId)
          if (!period) {
            continue
          }
          backfillJobs.push({
            jobId,
            period,
            remainingCount: Math.max(0, capacity) - (takenByJob.get(jobId) ?? 0),
            eligibleMemberIds: eligibilityByJob.get(jobId) ?? null,
          })
        }

        const backfilled = backfillUnmatched(
          zeroAssignmentMemberIds.map((memberId) => ({
            memberId,
            expressedRankByJobId: expressedRankByMember.get(memberId) ?? {},
          })),
          backfillJobs,
          memberTieBreak
        )

        for (const match of backfilled) {
          matched.push({
            ...match,
            pointsDelta: computePointsDelta(match.period, match.rankAchieved),
          })
          matchedMemberIds.add(match.memberId)
        }
      }

      const unmatchedMemberIds = respondingMembers
        .map((member) => member.id)
        .filter((memberId) => !matchedMemberIds.has(memberId) && !lockedMemberIds.has(memberId))
        .sort((a, b) => a - b)

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
          message: "Soirée déjà consolidée : l'affectation ne peut plus être relancée.",
        },
      })
    }

    return serialize(summary)
  }

  async settle({ params, serialize }: HttpContext) {
    const event = await Event.findOrFail(params.id)

    const summary = await db.transaction(async (trx) => {
      // The `UPDATE … RETURNING` is also the lock: a concurrent close blocks on
      // the same rows, then re-evaluates the predicate and finds nothing left to
      // claim. Reading the rows first and updating them afterwards would let two
      // calls apply the same pending set twice.
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

      for (const [memberId, delta] of deltaByMember) {
        if (delta !== 0) {
          await trx.from('members').where('id', memberId).increment('points', delta)
        }
      }

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
