import type { HttpContext } from '@adonisjs/core/http'
import Job from '#models/job'
import { jobValidator } from '#validators/coordination'

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
    const job = await Job.create({ type: 'during', ...payload })
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
   * Delete record
   */
  async destroy({ params, response }: HttpContext) {
    const job = await Job.query().where('id', params.id).firstOrFail()
    await job.delete()
    return response.noContent()
  }
}
