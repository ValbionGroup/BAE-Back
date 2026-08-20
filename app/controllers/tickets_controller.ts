import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Ticket from '#models/ticket'
import TicketMessage from '#models/ticket_message'
import Member from '#models/member'
import { changeStatus, openTicket } from '#services/ticket_service'
import {
  ticketOpenValidator,
  ticketReplyValidator,
  ticketStatusValidator,
} from '#validators/ticket'

/** Le support voit tout ; les autres ne voient que ce qu'ils ont écrit. */
async function canReadAll(userId: number): Promise<boolean> {
  const member = await Member.query()
    .where('id', userId)
    .preload('role', (roleQuery) => roleQuery.preload('permissions'))
    .first()

  const granted = new Set(member?.role?.permissions.map((entry) => entry.permission) ?? [])
  return granted.has('ticket:read')
}

function toPayload(ticket: Ticket) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    authorId: ticket.authorId,
    authorName: ticket.author?.fullName ?? null,
    createdAt: ticket.createdAt?.toISO() ?? null,
    updatedAt: ticket.updatedAt?.toISO() ?? null,
  }
}

export default class TicketsController {
  /**
   * ⚠️ Le périmètre dépend de la permission, **pas** d'un paramètre : laisser le
   * client demander « tous » ouvrirait la boîte de réception de tout le monde à
   * qui pense à l'essayer.
   */
  async index({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const query = Ticket.query().preload('author').orderBy('createdAt', 'desc')

    if (!(await canReadAll(user.id))) query.where('authorId', user.id)

    const tickets = await query
    return serialize(tickets.map(toPayload))
  }

  async store({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(ticketOpenValidator)

    const ticket = await openTicket({
      authorId: user.id,
      subject: payload.subject,
      body: payload.body,
      priority: payload.priority,
    })

    await ticket.load('author')
    return serialize(toPayload(ticket))
  }

  async show({ auth, params, response, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const ticket = await Ticket.query().where('id', params.id).preload('author').first()

    // 404 plutôt que 403 : distinguer les deux dirait à l'appelant qu'un ticket
    // existe sous cet identifiant.
    if (ticket === null || (ticket.authorId !== user.id && !(await canReadAll(user.id)))) {
      return response.notFound({
        error: { code: 'E_NOT_FOUND', message: 'Ticket introuvable.' },
      })
    }

    const messages = await db
      .from('ticket_messages')
      .leftJoin('users', 'users.id', 'ticket_messages.author_id')
      .where('ticket_messages.ticket_id', ticket.id)
      .orderBy('ticket_messages.created_at', 'asc')
      .select(
        'ticket_messages.id',
        'ticket_messages.body',
        'ticket_messages.author_id',
        'ticket_messages.created_at',
        'users.first_name',
        'users.last_name'
      )

    return serialize({
      ...toPayload(ticket),
      messages: messages.map((row) => ({
        id: Number(row.id),
        body: String(row.body),
        authorId: row.author_id === null ? null : Number(row.author_id),
        authorName: [row.first_name, row.last_name].filter((part) => part).join(' ') || null,
        createdAt: row.created_at === null ? null : new Date(row.created_at).toISOString(),
      })),
    })
  }

  async setStatus({ params, request, response, serialize }: HttpContext) {
    const ticket = await Ticket.find(params.id)
    if (ticket === null) {
      return response.notFound({
        error: { code: 'E_NOT_FOUND', message: 'Ticket introuvable.' },
      })
    }

    const { status } = await request.validateUsing(ticketStatusValidator)
    const updated = await changeStatus(ticket, status)
    await updated.load('author')

    return serialize(toPayload(updated))
  }

  async reply({ auth, params, request, response, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const ticket = await Ticket.find(params.id)

    if (ticket === null || (ticket.authorId !== user.id && !(await canReadAll(user.id)))) {
      return response.notFound({
        error: { code: 'E_NOT_FOUND', message: 'Ticket introuvable.' },
      })
    }

    const { body } = await request.validateUsing(ticketReplyValidator)
    const message = await TicketMessage.create({ ticketId: ticket.id, authorId: user.id, body })

    return serialize({ id: message.id, body: message.body, authorId: message.authorId })
  }
}
