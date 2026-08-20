import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

interface ActivityPayload {
  id: number
  verb: string
  subjectType: string
  subjectId: number
  actorName: string | null
  payload: Record<string, unknown>
  occurredAt: string | null
}

/**
 * Le fil d'activité de l'équipe : **qui a fait quoi**, en termes métier.
 *
 * ⚠️ Ne renvoie que les faits portant un **acteur**. Les rappels automatiques
 * vivent dans la même table mais n'ont pas d'auteur — les afficher donnerait
 * « le système a rappelé la présence », ce qui n'est pas de l'activité d'équipe
 * et noierait les vraies actions.
 *
 * C'est aussi la raison pour laquelle ce fil n'est pas branché sur `GET /logs` :
 * ce sont des journaux HTTP, et ils produiraient « lespiet a créé /v1/events ».
 */
export default class ActivityController {
  async index({ serialize }: HttpContext) {
    const rows = await db
      .from('activity_events')
      .leftJoin('users', 'users.id', 'activity_events.actor_id')
      .whereNotNull('activity_events.actor_id')
      .orderBy('activity_events.occurred_at', 'desc')
      .limit(30)
      .select(
        'activity_events.id',
        'activity_events.verb',
        'activity_events.subject_type',
        'activity_events.subject_id',
        'activity_events.payload',
        'activity_events.occurred_at',
        'users.first_name',
        'users.last_name'
      )

    const payloads: ActivityPayload[] = rows.map((row) => ({
      id: Number(row.id),
      verb: String(row.verb),
      subjectType: String(row.subject_type),
      subjectId: Number(row.subject_id),
      actorName: [row.first_name, row.last_name].filter((part) => part).join(' ') || null,
      payload: (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) ?? {},
      occurredAt:
        row.occurred_at === null ? null : DateTime.fromJSDate(new Date(row.occurred_at)).toISO(),
    }))

    return serialize(payloads)
  }
}
