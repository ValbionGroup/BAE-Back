import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import Job from '#models/job'
import {
  eventJobCountValidator,
  eventJobKeyValidator,
  eventJobValidator,
} from '#validators/coordination'

export default class EventJobsController {
  async index({ serialize }: HttpContext) {
    const events = await Event.query().preload('jobs').orderBy('id')
    const eventJobs = events.flatMap((event) =>
      event.jobs.map((job) => ({
        eventId: event.id,
        jobId: job.id,
        count: Number(job.$extras.pivot_count),
      }))
    )
    return serialize(eventJobs)
  }

  async store({ request, serialize }: HttpContext) {
    const { eventId, jobId, count } = await request.validateUsing(eventJobValidator)
    const event = await Event.findOrFail(eventId)
    await Job.findOrFail(jobId)
    await event.related('jobs').sync({ [jobId]: { count } }, false)
    return serialize({ eventId, jobId, count })
  }

  async update({ request, serialize }: HttpContext) {
    const { eventId, jobId } = await eventJobKeyValidator.validate(request.qs())
    const { count } = await request.validateUsing(eventJobCountValidator)
    const event = await Event.findOrFail(eventId)
    await event.related('jobs').query().where('jobs.id', jobId).firstOrFail()
    await event.related('jobs').sync({ [jobId]: { count } }, false)
    return serialize({ eventId, jobId, count })
  }

  async destroy({ request, response }: HttpContext) {
    const { eventId, jobId } = await eventJobKeyValidator.validate(request.qs())
    const event = await Event.findOrFail(eventId)
    await event.related('jobs').detach([jobId])
    return response.noContent()
  }
}
