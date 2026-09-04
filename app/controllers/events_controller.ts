import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import ApiException from '#exceptions/api_exception'
import { PRESENCE_PENDING, queueReminderForEvent } from '#services/presence_reminder_service'
import { recordEvent } from '#services/notification_service'
import { notifyAssignments } from '#services/assignment_notification_service'
import Job from '#models/job'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { availabilityValidator, eventUpdateValidator, eventValidator } from '#validators/event'
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

function parseEventDate(value: string): DateTime {
  const parsed = DateTime.fromISO(value)
  if (!parsed.isValid) {
    throw new ApiException('E_EVENT_INVALID_DATE', 'Cette date est illisible.', 422)
  }
  return parsed
}

export default class EventsController {
  async index({ serialize }: HttpContext) {
    const events = await Event.query()

    const counts = await db
      .from('member_event_assigned_jobs')
      .select('event_id')
      .countDistinct('member_id as assignees')
      .groupBy('event_id')

    const byEvent = new Map<number, number>(
      counts.map((row) => [Number(row.event_id), Number(row.assignees)])
    )

    return serialize(
      events.map((event) => ({
        ...event.serialize(),
        assigneeCount: byEvent.get(event.id) ?? 0,
      }))
    )
  }

  async store({ request, serialize }: HttpContext) {
    const { date, ...rest } = await request.validateUsing(eventValidator)
    const event = await Event.create({ ...rest, date: parseEventDate(date) })
    return serialize(event)
  }

  async show({ params, serialize }: HttpContext) {
    const event = await Event.query().where('id', params.id).firstOrFail()
    return serialize(event)
  }

  async update({ params, request, serialize }: HttpContext) {
    const event = await Event.query().where('id', params.id).firstOrFail()
    const { date, ...rest } = await request.validateUsing(eventUpdateValidator)
    // `merge` et non des affectations : une clé absente du payload validé doit
    // laisser sa colonne intacte, sans quoi un PATCH partiel efface le reste.
    event.merge(rest)
    if (date !== undefined) event.date = parseEventDate(date)
    await event.save()
    return serialize(event)
  }

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

  /**
   * « Valider l'affectation » : annonce aux membres affectés que la composition
   * est arrêtée. Le geste ne verrouille **rien** — il n'existe pas d'état
   * « validé » en base, et en inventer un imposerait une garde sur chaque
   * écriture de `AssignmentsController` pour un invariant que le cahier des
   * charges n'a jamais demandé.
   *
   * Rejouable sans risque : l'idempotence porte sur l'empreinte de
   * l'affectation, pas sur la soirée (cf. `assignment_notification_service`).
   */
  async notifyAssignments({ params, response, serialize, auth }: HttpContext) {
    const event = await Event.findOrFail(params.id)

    // Le template désactive déjà le bouton sur une soirée clôturée ; cette garde
    // couvre le chemin clavier et l'appel direct, comme celle de `open`.
    if (event.status === 'completed') {
      return response.conflict({
        error: {
          code: 'E_EVENT_CLOSED',
          message: 'Cette soirée est clôturée : son affectation ne s’annonce plus.',
        },
      })
    }

    return serialize(await notifyAssignments(event, auth.user?.id ?? null))
  }

  async settle({ params, serialize, auth }: HttpContext) {
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

      // Consolider les points et fermer la soirée sont **le même geste**, et il
      // n'y en a qu'un : le §6.4 du HANDOFF laissait le choix entre cet endpoint
      // et un passage de `events.status`, et seule la moitié « points » avait
      // été faite. La caisse et la vue live dérivent de `status` : sans cette
      // ligne, clôturer ne fermait rien à l'écran ni en base.
      await trx.from('events').where('id', event.id).update({ status: 'completed' })

      return {
        settled: claimed.length,
        alreadySettled: Math.max(0, Number(settledTotal?.total ?? 0) - claimed.length),
        totalDelta,
        status: 'completed' as const,
      }
    })

    // Trace pour le fil d'activité : la clôture est le geste le plus notable
    // d'une soirée. Volontairement pas d'événement par commande — quelques
    // centaines de ventes noieraient les actions qui méritent d'être vues.
    if (auth.user) {
      await recordEvent({
        verb: 'event.settled',
        actorId: auth.user.id,
        subjectType: 'event',
        subjectId: event.id,
        payload: { what: 'a clôturé la soirée', emphasis: event.name },
        dedupeKey: `event.settled:${event.id}`,
      })
    }

    return serialize(summary)
  }

  /**
   * L'ouverture d'une soirée — le pendant de `settle`, et la **seule** porte
   * vers `status = 'ongoing'` : `eventUpdateValidator` ne porte plus `status`,
   * sans quoi un PATCH générique contournerait l'invariant ci-dessous.
   *
   * Invariant : **au plus une soirée ouverte**. `EventsStore.activeEvent` prend
   * la plus ancienne des `ongoing` ; une soirée laissée ouverte captait donc la
   * caisse et la vue live indéfiniment, quelle que soit la soirée du jour.
   *
   * ⚠️ Le verrou est transactionnel, pas structurel : deux ouvertures
   * simultanées de **soirées différentes** ne se voient pas (chacune verrouille
   * sa propre ligne, et `WHERE status = 'ongoing'` ne verrouille rien quand il
   * ne ramène rien). Un index unique partiel serait étanche ; il suppose une
   * base déjà conforme, ce que celle de dev n'est pas encore.
   *
   * Idempotent : rouvrir la soirée déjà ouverte n'écrit rien et répond 200.
   */
  async open({ params, response, serialize, auth }: HttpContext) {
    const event = await Event.findOrFail(params.id)

    const refusal = await db.transaction(async (trx) => {
      const current = await trx.from('events').where('id', event.id).forUpdate().first()

      if (current.status === 'completed') {
        return {
          code: 'E_EVENT_CLOSED',
          message: 'Cette soirée est clôturée : déclôturez-la d’abord.',
        }
      }

      if (current.status === 'ongoing') return null

      const other = await trx
        .from('events')
        .where('status', 'ongoing')
        .whereNot('id', event.id)
        .forUpdate()
        .first()

      if (other) {
        return {
          code: 'E_EVENT_ALREADY_OPEN',
          message: `« ${other.name} » est déjà ouverte : clôturez-la avant d’en ouvrir une autre.`,
        }
      }

      await trx.from('events').where('id', event.id).update({ status: 'ongoing' })
      return null
    })

    if (refusal !== null) {
      return response.conflict({ error: refusal })
    }

    await event.refresh()

    // Symétrique de `event.settled` : ouvrir et clôturer sont les deux gestes
    // d'une soirée qui méritent le fil d'activité.
    if (auth.user) {
      await recordEvent({
        verb: 'event.opened',
        actorId: auth.user.id,
        subjectType: 'event',
        subjectId: event.id,
        payload: { what: 'a ouvert la soirée', emphasis: event.name },
        dedupeKey: `event.opened:${event.id}`,
      })
    }

    return serialize(event)
  }

  /**
   * Relance à la demande les membres sans réponse d'une soirée.
   *
   * ⚠️ La clé porte le **jour**, contrairement au cron dont la clé est « ce
   * verbe, cette soirée ». Sans cela, un clic après le passage du cron de 10 h
   * ne créerait rien et l'écran annoncerait quand même un succès.
   *
   * `queued` et `alreadySent` comptent des **membres**, jamais des lignes de
   * notification : `emit()` compte des couples destinataire × canal, et
   * « 4 membres relancés » deviendrait « 8 » dès qu'un membre a lié Telegram.
   */
  async remind({ params, serialize }: HttpContext) {
    const event = await Event.find(params.id)
    if (!event) {
      throw new ApiException('E_EVENT_NOT_FOUND', 'Soirée introuvable.', 404)
    }

    if (event.status !== 'scheduled') {
      throw new ApiException(
        'E_EVENT_NOT_SCHEDULED',
        'On ne relance pas sur une soirée passée ou en cours.',
        422
      )
    }

    const today = DateTime.now().toISODate()
    const report = await queueReminderForEvent(
      PRESENCE_PENDING,
      { id: event.id, name: event.name, date: event.date.toJSDate() },
      `${PRESENCE_PENDING.verb}:${event.id}:manual:${today}`
    )

    const announced = report.created > 0

    return serialize({
      queued: announced ? report.candidates : 0,
      alreadySent: announced ? 0 : report.candidates,
    })
  }

  /**
   * `late` dit qu'un rappel `presence.pending` est déjà parti à ce membre pour
   * cette soirée — le badge « Rappelé·e » de l'écran des présences. Une seule
   * requête pour tout le roster, jamais une par membre.
   */
  async roster({ params, serialize }: HttpContext) {
    await Event.findOrFail(params.id)

    const members = await Member.query()
      .preload('user')
      .preload('responses', (q) => q.where('events.id', params.id))

    const reminded = await db
      .from('notifications')
      .join('activity_events', 'activity_events.id', 'notifications.event_id')
      .where('activity_events.verb', PRESENCE_PENDING.verb)
      .where('activity_events.subject_type', 'event')
      .where('activity_events.subject_id', params.id)
      .distinct('notifications.user_id as user_id')

    const remindedIds = new Set(reminded.map((row) => Number(row.user_id)))

    const roster = members.map((m) => {
      const response = m.responses[0]
      const status = response ? (response.$extras.pivot_is_available ? 1 : 0) : -1
      return {
        id: m.id,
        name: m.user.fullName ?? m.user.email,
        status,
        late: remindedIds.has(m.id),
      }
    })

    return serialize(roster)
  }
}
