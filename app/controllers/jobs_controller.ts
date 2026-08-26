import type { HttpContext } from '@adonisjs/core/http'
import Job from '#models/job'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import db from '@adonisjs/lucid/services/db'
import { jobValidator } from '#validators/coordination'
import { DEFAULT_JOB_PERIOD } from '#services/matching_service'

export default class JobsController {
  async index({ serialize }: HttpContext) {
    return serialize(await Job.query().orderBy('id'))
  }

  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(jobValidator)
    const job = await Job.create({ type: DEFAULT_JOB_PERIOD, ...payload })
    return serialize(job)
  }

  async show({ params, serialize }: HttpContext) {
    const job = await Job.query().where('id', params.id).firstOrFail()
    return serialize(job)
  }

  async update({ params, request, serialize }: HttpContext) {
    const job = await Job.query().where('id', params.id).firstOrFail()
    const payload = await request.validateUsing(jobValidator)
    job.merge(payload)
    await job.save()
    return serialize(job)
  }

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
            message: 'Poste tenu sur une soirée consolidée : déclôturez-la d’abord.',
          },
        })
        return
      }

      // ⚠️ Trois tables sont en CASCADE sur `jobs` : les besoins par soirée, les
      // éligibilités, et les vœux des membres. Les laisser partir en silence
      // effacerait un travail humain — un membre a classé ses préférences.
      //
      // Distinct de `E_JOB_SETTLED` : celui-là se corrige en déclôturant une
      // soirée, celui-ci en retirant le poste des soirées qui le demandent.
      const [needed, preferred, eligible] = await Promise.all([
        trx.from('event_jobs').where('job_id', job.id).count('* as total').first(),
        trx.from('member_job_preferences').where('job_id', job.id).count('* as total').first(),
        trx.from('job_eligible_members').where('job_id', job.id).count('* as total').first(),
      ])

      const causes = [
        Number(needed?.total ?? 0) > 0 ? `${Number(needed?.total)} soirée(s)` : null,
        Number(preferred?.total ?? 0) > 0 ? `${Number(preferred?.total)} vœu(x)` : null,
        Number(eligible?.total ?? 0) > 0 ? `${Number(eligible?.total)} éligibilité(s)` : null,
      ].filter((cause): cause is string => cause !== null)

      if (causes.length > 0) {
        response.conflict({
          error: {
            code: 'E_JOB_IN_USE',
            message: `« ${job.name} » est encore rattaché à ${causes.join(', ')} : retirez-le d’abord.`,
          },
        })
        return
      }

      await MemberEventAssignedJob.query({ client: trx })
        .where('jobId', job.id)
        .whereNull('settledAt')
        .delete()
      await job.useTransaction(trx).delete()
      response.noContent()
    })
  }
}
