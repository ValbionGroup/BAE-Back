import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { presenceStates } from '#services/presence_service'
import type { PresenceState } from '#services/presence_service'
import { emit } from '#services/notification_service'

export type ReminderKind = {
  verb: string
  targetState: PresenceState
  subject: string
  body: (eventName: string, when: string) => string
}

export const PRESENCE_PENDING: ReminderKind = {
  verb: 'presence.pending',
  targetState: 'pending',
  subject: 'Réponds pour la prochaine soirée',
  body: (eventName, when) => `${eventName} a lieu ${when}, et tu n'as pas encore dit si tu venais.`,
}

export const PRESENCE_UPCOMING: ReminderKind = {
  verb: 'presence.upcoming',
  targetState: 'in',
  subject: 'Ta participation approche',
  body: (eventName, when) => `Tu es attendu·e pour ${eventName}, ${when}.`,
}

/**
 * Le rappel de la veille. Verbe distinct de `presence.upcoming`, et non une
 * fenêtre plus courte du même : une clé partagée ferait que le passage à J-3
 * inhibe celui à J-1, sans rien signaler.
 *
 * Le corps annonce la ligne que `notification_renderer` ajoute au moment de
 * l'envoi — le poste de chacun, qu'un fait partagé ne peut pas porter.
 */
export const PRESENCE_TOMORROW: ReminderKind = {
  verb: 'presence.tomorrow',
  targetState: 'in',
  subject: "C'est demain",
  body: (eventName, when) => `${eventName}, ${when}. Voici ton poste.`,
}

export type ReminderReport = {
  eventId: number
  eventName: string
  /** Membres dans l'état visé — ce que `--dry-run` annonce. */
  candidates: number
  created: number
  skipped: number
}

export type ReminderEvent = { id: number; name: string; date: Date }

/**
 * Met en file le rappel d'**une** soirée, désignée par son identité et non par
 * une fenêtre de dates.
 *
 * La clé de déduplication est un paramètre : le balayage porte l'identité métier
 * du rappel (« ce verbe, cette soirée »), la relance manuelle y ajoute le jour —
 * sans quoi elle serait muette dès que le cron est passé.
 */
export async function queueReminderForEvent(
  kind: ReminderKind,
  event: ReminderEvent,
  dedupeKey: string
): Promise<ReminderReport> {
  const states = await presenceStates(event.id)
  const recipients = [...states.entries()]
    .filter(([, state]) => state === kind.targetState)
    .map(([memberId]) => memberId)

  if (recipients.length === 0) {
    return { eventId: event.id, eventName: event.name, candidates: 0, created: 0, skipped: 0 }
  }

  const when = DateTime.fromJSDate(event.date).setLocale('fr').toFormat("cccc d LLLL 'à' HH'h'mm")

  const result = await emit({
    verb: kind.verb,
    subjectType: 'event',
    subjectId: event.id,
    payload: {
      subject: kind.subject,
      lines: [kind.body(event.name, when)],
      eventName: event.name,
    },
    recipients,
    dedupeKey,
  })

  return {
    eventId: event.id,
    eventName: event.name,
    candidates: recipients.length,
    created: result.created,
    skipped: result.skipped,
  }
}

/**
 * Détecte et met en file, mais **n'envoie pas** : l'envoi est le rôle de
 * `notify:dispatch`.
 *
 * Le `dedupeKey` porte l'identité métier du rappel — « ce verbe, cette soirée » —
 * ce qui rend la commande rejouable : un cron qui se chevauche, ou une reprise
 * après incident, ne produit pas un second envoi.
 */
export async function queuePresenceReminders(
  kind: ReminderKind,
  days: number,
  options: { dryRun?: boolean } = {},
  now: DateTime = DateTime.now()
): Promise<ReminderReport[]> {
  const horizon = now.plus({ days })

  const events = await db
    .from('events')
    .where('status', 'scheduled')
    .where('date', '>=', now.toSQL()!)
    .where('date', '<=', horizon.toSQL()!)
    .select('id', 'name', 'date')

  const reports: ReminderReport[] = []

  for (const row of events) {
    const event: ReminderEvent = {
      id: Number(row.id),
      name: String(row.name),
      date: new Date(row.date),
    }

    // Le `--dry-run` sort **ici**, après la sélection et avant l'écriture : la
    // liste annoncée est donc exactement celle qui partirait.
    if (options.dryRun === true) {
      const states = await presenceStates(event.id)
      const candidates = [...states.values()].filter((state) => state === kind.targetState).length
      if (candidates === 0) continue
      reports.push({
        eventId: event.id,
        eventName: event.name,
        candidates,
        created: 0,
        skipped: 0,
      })
      continue
    }

    const report = await queueReminderForEvent(kind, event, `${kind.verb}:${event.id}`)
    if (report.candidates === 0) continue
    reports.push(report)
  }

  return reports
}
