import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Notification from '#models/notification'

interface NotificationPayload {
  id: number
  verb: string
  subjectType: string
  subjectId: number
  payload: Record<string, unknown>
  occurredAt: string | null
  readAt: string | null
}

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? DateTime.fromJSDate(value) : DateTime.fromISO(String(value))
  return date.isValid ? date.toISO() : null
}

/**
 * Les notifications **de l'utilisateur connecté**, jamais celles des autres :
 * chaque requête est filtrée sur `auth.getUserOrFail()`, et aucun paramètre ne
 * permet de désigner un destinataire. Une notification est une projection
 * personnelle — le flux global, lui, c'est `activity_events`.
 */
export default class NotificationsController {
  async index({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    const rows = await db
      .from('notifications')
      .join('activity_events', 'activity_events.id', 'notifications.event_id')
      .where('notifications.user_id', user.id)
      .where('notifications.channel', 'in_app')
      .orderBy('activity_events.occurred_at', 'desc')
      .limit(100)
      .select(
        'notifications.id as id',
        'notifications.read_at as read_at',
        'activity_events.verb as verb',
        'activity_events.subject_type as subject_type',
        'activity_events.subject_id as subject_id',
        'activity_events.payload as payload',
        'activity_events.occurred_at as occurred_at'
      )

    const payloads: NotificationPayload[] = rows.map((row) => ({
      id: Number(row.id),
      verb: String(row.verb),
      subjectType: String(row.subject_type),
      subjectId: Number(row.subject_id),
      payload: (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) ?? {},
      occurredAt: toIso(row.occurred_at),
      readAt: toIso(row.read_at),
    }))

    return serialize(payloads)
  }

  /**
   * ⚠️ Le `where user_id` n'est pas une commodité de requête, c'est le contrôle
   * d'accès : sans lui, n'importe quel membre marquerait lue la notification de
   * n'importe qui en devinant un identifiant. Le 404 qui en découle ne distingue
   * pas « inexistante » de « pas à vous », et c'est voulu.
   */
  async markRead({ auth, params, response, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    const notification = await Notification.query()
      .where('id', params.id)
      .where('userId', user.id)
      .first()

    if (notification === null) {
      return response.notFound({
        error: { code: 'E_NOT_FOUND', message: 'Notification introuvable.' },
      })
    }

    // Idempotent : relire une notification déjà lue ne réécrit pas sa date, sinon
    // « lue il y a 2 jours » deviendrait « lue à l'instant » à chaque affichage.
    if (notification.readAt === null) {
      notification.readAt = DateTime.now()
      await notification.save()
    }

    return serialize({ id: notification.id, readAt: notification.readAt?.toISO() ?? null })
  }

  async markAllRead({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    const updated = await db
      .from('notifications')
      .where('user_id', user.id)
      .whereNull('read_at')
      .update({ read_at: DateTime.now().toSQL() })

    return serialize({ updated: Number(updated) })
  }
}
