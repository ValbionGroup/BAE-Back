import db from '@adonisjs/lucid/services/db'
import { readNotificationPayload } from '#services/notification_payload'
import { JOB_PERIODS } from '#services/matching_service'
import type { JobPeriod } from '#services/matching_service'
import { PERIOD_LABELS } from '#services/job_periods'
import { ASSIGNMENTS_PUBLISHED } from '#services/assignment_notification_service'

export type RenderedMessage = { subject: string; lines: string[] }

/** Une ligne de `notifications` jointe à son fait, telle que les distributeurs la lisent. */
export type Delivery = {
  id: number
  userId: number
  verb: string
  subjectId: number
  payload: unknown
}

/**
 * Rend, pour un sujet et un lot de destinataires, les lignes propres à chacun.
 * Reçoit le lot entier : une requête par groupe, jamais une par destinataire.
 */
export type Personalizer = (
  subjectId: number,
  userIds: readonly number[]
) => Promise<Map<number, string[]>>

const NO_ASSIGNMENT = "Aucun poste ne t'est attribué pour l'instant."

const PERIOD_RANK = new Map<string, number>(JOB_PERIODS.map((period, index) => [period, index]))

/**
 * Les postes tenus par chaque destinataire sur cette soirée, en ordre
 * chronologique.
 *
 * ⚠️ Le tri se fait ici et non en SQL : `jobs.type` est une chaîne libre, donc
 * `ORDER BY type` donnerait l'ordre alphabétique — « after » avant « before ».
 * Un type hors vocabulaire tombe en fin de liste plutôt que de disparaître.
 */
export const assignmentLines: Personalizer = async (subjectId, userIds) => {
  const rows = await db
    .from('member_event_assigned_jobs')
    .join('jobs', 'jobs.id', 'member_event_assigned_jobs.job_id')
    .where('member_event_assigned_jobs.event_id', subjectId)
    .whereIn('member_event_assigned_jobs.member_id', [...userIds])
    .select(
      'member_event_assigned_jobs.member_id as member_id',
      'jobs.name as name',
      'jobs.type as type'
    )

  const byMember = new Map<number, { name: string; type: string }[]>()
  for (const row of rows) {
    const memberId = Number(row.member_id)
    const held = byMember.get(memberId) ?? []
    held.push({ name: String(row.name), type: String(row.type) })
    byMember.set(memberId, held)
  }

  const lines = new Map<number, string[]>()
  for (const userId of userIds) {
    const held = byMember.get(userId)
    if (held === undefined || held.length === 0) {
      lines.set(userId, [NO_ASSIGNMENT])
      continue
    }

    held.sort(
      (a, b) =>
        (PERIOD_RANK.get(a.type) ?? JOB_PERIODS.length) -
        (PERIOD_RANK.get(b.type) ?? JOB_PERIODS.length)
    )

    lines.set(
      userId,
      held.map((job) => {
        const label = PERIOD_LABELS[job.type as JobPeriod]
        return label === undefined
          ? `Ton poste : ${job.name}`
          : `Ton poste : ${job.name} — ${label}`
      })
    )
  }

  return lines
}

/**
 * ⚠️ Indexé par **chaîne**, jamais par import : importer `PRESENCE_TOMORROW`
 * depuis `presence_reminder_service` créerait un cycle, ce service important
 * `notification_service`. Un verbe inscrit mais jamais émis ne coûte rien.
 */
const PERSONALIZERS: Record<string, Personalizer> = {
  [ASSIGNMENTS_PUBLISHED]: assignmentLines,
  'presence.tomorrow': assignmentLines,
}

/**
 * Rend le message final de chaque livraison, indexé par `notifications.id`.
 *
 * Le défaut est le payload du fait, tel quel : un verbe absent du registre se
 * comporte exactement comme avant l'existence de ce module.
 *
 * `personalizers` n'est paramétrable que pour les tests — la production prend le
 * registre du module.
 */
export async function renderDeliveries(
  deliveries: readonly Delivery[],
  personalizers: Record<string, Personalizer> = PERSONALIZERS
): Promise<Map<number, RenderedMessage>> {
  const groups = new Map<string, { verb: string; subjectId: number; userIds: number[] }>()

  for (const delivery of deliveries) {
    if (personalizers[delivery.verb] === undefined) continue
    const key = `${delivery.verb}:${delivery.subjectId}`
    const group = groups.get(key)
    if (group === undefined) {
      groups.set(key, {
        verb: delivery.verb,
        subjectId: delivery.subjectId,
        userIds: [delivery.userId],
      })
    } else {
      group.userIds.push(delivery.userId)
    }
  }

  const extraByGroup = new Map<string, Map<number, string[]>>()
  for (const [key, group] of groups) {
    extraByGroup.set(key, await personalizers[group.verb](group.subjectId, group.userIds))
  }

  const rendered = new Map<number, RenderedMessage>()
  for (const delivery of deliveries) {
    const { subject, lines } = readNotificationPayload(delivery.payload)
    const extra = extraByGroup.get(`${delivery.verb}:${delivery.subjectId}`)?.get(delivery.userId)
    rendered.set(delivery.id, { subject, lines: extra ? [...lines, ...extra] : lines })
  }

  return rendered
}
