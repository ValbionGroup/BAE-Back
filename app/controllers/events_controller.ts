import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import Member from '#models/member'
import db from '@adonisjs/lucid/services/db'
import { availabilityValidator } from '#validators/event'

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
