import type { HttpContext } from '@adonisjs/core/http'
import Job from '#models/job'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import db from '@adonisjs/lucid/services/db'
import { jobValidator } from '#validators/coordination'
import { DEFAULT_JOB_PERIOD } from '#services/matching_service'

export default class JobsController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    return serialize(await Job.query().orderBy('id'))
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(jobValidator)
    const job = await Job.create({ type: DEFAULT_JOB_PERIOD, ...payload })
    return serialize(job)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    const job = await Job.query().where('id', params.id).firstOrFail()
    return serialize(job)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
    const job = await Job.query().where('id', params.id).firstOrFail()
    const payload = await request.validateUsing(jobValidator)
    job.merge(payload)
    await job.save()
    return serialize(job)
  }

  /**
   * Delete record — unless a consolidated assignment still points at it.
   *
   * Same reasoning as `EventsController.destroy`: `members.points` is derived
   * from the settled `points_delta`, so a settled row may not vanish or
   * `points:recompute` would erase real credit. Unsettled rows are dropped by
   * hand, the FK being `RESTRICT`.
   */
  async destroy({ params, response }: HttpContext) {
    const job = await Job.query().where('id', params.id).firstOrFail()

    await db.transaction(async (trx) => {
      const settled = await MemberEventAssignedJob.query({ client: trx })
        .where('jobId', job.id)
        .whereNotNull('settledAt')
        .first()

      if (settled) {
        response.conflict({
          error: {
            code: 'E_JOB_SETTLED',
            message: 'Poste tenu sur une soirée consolidée. Déclôturez-la avant de le supprimer.',
          },
        })
        return
      }

      await MemberEventAssignedJob.query({ client: trx }).where('jobId', job.id).delete()
      await job.useTransaction(trx).delete()
      response.noContent()
    })
  }
}
