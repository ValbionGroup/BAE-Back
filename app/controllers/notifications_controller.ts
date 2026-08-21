import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Notification from '#models/notification'

interface DeliveryPayload {
  channel: string
  sentAt: string | null
}

interface NotificationPayload {
  id: number
  verb: string
  subjectType: string
  subjectId: number
  payload: Record<string, unknown>
  occurredAt: string | null
  readAt: string | null
  channels: DeliveryPayload[]
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

    // Deux requêtes, parce que la borne porte sur les **faits** et non sur les
    // livraisons : la poser sur une requête à plat couperait un fait au milieu de
    // ses canaux, et la lever pour l'appliquer en mémoire ferait remonter tout
    // l'historique de la personne.
    const recentEvents = await db
      .from('notifications')
      .join('activity_events', 'activity_events.id', 'notifications.event_id')
      .where('notifications.user_id', user.id)
      .groupBy('notifications.event_id', 'activity_events.occurred_at')
      .orderBy('activity_events.occurred_at', 'desc')
      .limit(100)
      .select('notifications.event_id as event_id')

    const eventIds = recentEvents.map((row) => Number(row.event_id))
    if (eventIds.length === 0) return serialize([])

    const rows = await db
      .from('notifications')
      .join('activity_events', 'activity_events.id', 'notifications.event_id')
      .where('notifications.user_id', user.id)
      .whereIn('notifications.event_id', eventIds)
      .select(
        'notifications.id as id',
        'notifications.event_id as event_id',
        'notifications.channel as channel',
        'notifications.sent_at as sent_at',
        'notifications.read_at as read_at',
        'activity_events.verb as verb',
        'activity_events.subject_type as subject_type',
        'activity_events.subject_id as subject_id',
        'activity_events.payload as payload',
        'activity_events.occurred_at as occurred_at'
      )

    const byEvent = new Map<number, NotificationPayload>()

    for (const row of rows) {
      const eventId = Number(row.event_id)
      const existing = byEvent.get(eventId)

      if (existing === undefined) {
        byEvent.set(eventId, {
          id: Number(row.id),
          verb: String(row.verb),
          subjectType: String(row.subject_type),
          subjectId: Number(row.subject_id),
          payload: (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) ?? {},
          occurredAt: toIso(row.occurred_at),
          readAt: toIso(row.read_at),
          channels: [{ channel: String(row.channel), sentAt: toIso(row.sent_at) }],
        })
        continue
      }

      existing.channels.push({ channel: String(row.channel), sentAt: toIso(row.sent_at) })

      // `in_app` fait référence pour l'identité et l'état de lecture de l'entrée :
      // c'est la livraison que l'écran manipule. Écrit sans dépendre de l'ordre
      // des lignes, pour qu'un changement de tri ne déplace pas l'identité.
      if (row.channel === 'in_app') {
        existing.id = Number(row.id)
        existing.readAt = toIso(row.read_at)
      }
    }

    // L'ordre vient de la première requête : la seconde n'est pas triée, et s'y
    // fier laisserait Postgres rendre les lignes dans l'ordre qui l'arrange.
    const payloads = eventIds
      .map((eventId) => byEvent.get(eventId))
      .filter((entry): entry is NotificationPayload => entry !== undefined)

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
    //
    // La lecture porte sur le **fait**, donc sur toutes ses livraisons à cette
    // personne : l'écran n'affiche qu'une entrée par fait, et laisser la livraison
    // jumelle non lue maintiendrait le compteur « Non lues » au-dessus de zéro
    // sans que rien à l'écran puisse être cliqué pour le faire retomber.
    if (notification.readAt === null) {
      const readAt = DateTime.now()
      await Notification.query()
        .where('eventId', notification.eventId)
        .where('userId', user.id)
        .whereNull('readAt')
        .update({ read_at: readAt.toSQL() })
      notification.readAt = readAt
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
