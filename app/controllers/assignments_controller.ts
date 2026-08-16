import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import Job from '#models/job'
import Member from '#models/member'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import db from '@adonisjs/lucid/services/db'
import { assignmentLockValidator, assignmentValidator } from '#validators/coordination'
import { type JobPeriod, computePointsDelta } from '#services/matching_service'
import { buildAssignmentsHtml, type AssignmentPeriod } from '#services/print/print_assignments'
import { printFooterTemplate } from '#services/print/print_layout'
import { pdfService } from '#services/pdf_service'

const PERIOD_LABELS: Record<JobPeriod, string> = {
  before: 'Avant · Préparation',
  during: 'Pendant · Service',
  after: 'Après · Nettoyage',
}

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
  async index({ serialize }: HttpContext) {
    const assignments = await MemberEventAssignedJob.query()
      .orderBy('eventId')
      .orderBy('jobId')
      .orderBy('memberId')
    return serialize(assignments.map(toWire))
  }

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
      // Une affectation manuelle est verrouillée d'office : le CDC (§20.1) exige que
      // le prochain lancement de l'algorithme ne l'écrase pas. `runMatching` ne
      // touche déjà qu'aux lignes `locked = false` — seul le défaut ici était faux.
      locked: locked ?? true,
      pointsDelta,
    })

    return serialize(toWire(created))
  }

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
        error: { code: 'E_ROW_NOT_FOUND', message: 'Affectation introuvable.' },
      })
    }

    // Explicit builder rather than `assignment.save()`: the real primary key is
    // composite, but the generated schema only marks `member_id` as primary — so
    // `save()` would lock EVERY row of that member, across every evening. A row
    // locked by accident then survives the `.where('locked', false).delete()` of
    // a matching re-run.
    await MemberEventAssignedJob.query()
      .where('memberId', memberId)
      .where('eventId', eventId)
      .where('jobId', jobId)
      .update({ locked })

    assignment.locked = locked
    return serialize(toWire(assignment))
  }

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

      // Only a SETTLED row has anything to refund: an unsettled delta never
      // reached `members.points`. The `forUpdate` above closes the window against
      // a concurrent `settle`, which would consolidate the row between our read
      // and our delete — the credit would then survive its own assignment.
      if (assignment.settledAt !== null && assignment.pointsDelta !== 0) {
        await trx.from('members').where('id', memberId).decrement('points', assignment.pointsDelta)
      }

      await MemberEventAssignedJob.query({ client: trx })
        .where('memberId', memberId)
        .where('eventId', eventId)
        .where('jobId', jobId)
        .delete()
    })

    return response.noContent()
  }

  async pdf({ params, response }: HttpContext) {
    const event = await Event.query().where('id', params.id).preload('jobs').firstOrFail()
    const assignments = await MemberEventAssignedJob.query()
      .where('eventId', params.id)
      .preload('member', (query) => query.preload('user'))
      .preload('job')

    const byJobId = new Map<number, { memberFullName: string; locked: boolean }[]>()
    for (const assignment of assignments) {
      const list = byJobId.get(assignment.jobId) ?? []
      list.push({
        memberFullName: assignment.member.user.fullName ?? '—',
        locked: assignment.locked,
      })
      byJobId.set(assignment.jobId, list)
    }

    const periods: AssignmentPeriod[] = (['before', 'during', 'after'] as const).map((type) => ({
      label: PERIOD_LABELS[type],
      jobs: event.jobs
        .filter((job) => job.type === type)
        .map((job) => {
          const requiredCount = Number(job.$extras.pivot_count)
          const filled = byJobId.get(job.id) ?? []
          const slots = Array.from({ length: Math.max(requiredCount, filled.length) }, (_, i) =>
            filled[i]
              ? { name: filled[i].memberFullName, locked: filled[i].locked }
              : { name: null, locked: false }
          )
          return { jobName: job.name, requiredCount, slots }
        }),
    }))

    const buffer = await pdfService.generateFromHtml(buildAssignmentsHtml(event.name, periods), {
      landscape: true,
      footerTemplate: printFooterTemplate(
        'Instantané généré automatiquement — non mis à jour après impression.'
      ),
    })
    response.header('Content-Type', 'application/pdf')
    response.header('Content-Disposition', `inline; filename="affectation-${params.id}.pdf"`)
    return response.send(buffer)
  }
}
