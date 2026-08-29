import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { emit } from '#services/notification_service'
import type Event from '#models/event'

export const ASSIGNMENTS_PUBLISHED = 'event.assignments_published'

/**
 * Les trois compteurs sont en **membres**, jamais en lignes de notification.
 * `emit()` compte des couples destinataire × canal : deux membres sur deux
 * canaux font quatre lignes, et annoncer « 4 membres prévenus » serait faux.
 */
export type NotifyAssignmentsResult = {
  /** Membres prévenus — 0 quand rien n'a changé depuis la dernière annonce. */
  notified: number
  /** Membres qu'on n'a pas re-dérangés parce que l'affectation est inchangée. */
  skipped: number
  /** Membres affectés au moment de l'appel, prévenus ou non. */
  recipients: number
}

const CHANNELS = ['in_app', 'mail'] as const

/**
 * Empreinte de l'affectation : les couples `membre:poste` triés, condensés.
 *
 * ⚠️ C'est ce qui distingue cette notification des rappels de présence. Ceux-ci
 * dédupliquent sur « ce verbe, cette soirée », ce qui convient à un cron qui se
 * rejoue. Ici, la même clé rendrait **muette** toute revalidation : on corrige
 * une affectation, on revalide, et personne n'est prévenu. En faisant porter la
 * clé par l'état notifié, revalider sans changement ne fait rien et revalider
 * après un changement prévient de nouveau.
 *
 * Le tri est indispensable : l'ordre des lignes rendues par Postgres n'est pas
 * garanti, et deux lectures du même état doivent donner la même empreinte.
 */
function fingerprint(rows: readonly MemberEventAssignedJob[]): string {
  const pairs = rows.map((row) => `${row.memberId}:${row.jobId}`).sort()
  return createHash('sha1').update(pairs.join('|')).digest('hex').slice(0, 16)
}

/**
 * Annonce aux membres affectés que l'affectation de la soirée est arrêtée.
 *
 * Un seul fait pour tous les destinataires, comme les autres émetteurs : le fil
 * d'activité est global, et un fait par membre y noierait tout le reste. Le
 * message reste donc générique — il renvoie à l'écran plutôt que de nommer le
 * poste de chacun, qu'un fait partagé ne peut de toute façon pas personnaliser.
 */
export async function notifyAssignments(
  event: Event,
  actorId: number | null
): Promise<NotifyAssignmentsResult> {
  const rows = await MemberEventAssignedJob.query().where('eventId', event.id)

  if (rows.length === 0) return { notified: 0, skipped: 0, recipients: 0 }

  // `members.id` **est** l'id du user — la table partage sa clé primaire avec
  // `users`, il n'y a donc aucune jointure à faire pour obtenir un destinataire.
  const recipients = [...new Set(rows.map((row) => row.memberId))]

  const when = DateTime.fromJSDate(event.date.toJSDate())
    .setLocale('fr')
    .toFormat("cccc d LLLL 'à' HH'h'mm")

  const result = await emit({
    verb: ASSIGNMENTS_PUBLISHED,
    actorId,
    subjectType: 'event',
    subjectId: event.id,
    payload: {
      subject: `Ton affectation pour ${event.name}`,
      lines: [
        `L'affectation de ${event.name}, ${when}, est arrêtée.`,
        'Retrouve ton poste dans l’espace BAE, onglet Présences.',
      ],
      eventName: event.name,
    },
    recipients,
    channels: CHANNELS,
    dedupeKey: `${ASSIGNMENTS_PUBLISHED}:${event.id}:${fingerprint(rows)}`,
  })

  // La déduplication est **tout ou rien** : elle porte sur le fait, pas sur
  // chaque ligne. Soit le fait est neuf et tous les destinataires sont écrits,
  // soit il existe déjà et aucun ne l'est. Il n'y a donc pas de demi-envoi à
  // décrire, et repasser des lignes aux membres est exact.
  const announced = result.created > 0

  return {
    notified: announced ? recipients.length : 0,
    skipped: announced ? 0 : recipients.length,
    recipients: recipients.length,
  }
}
