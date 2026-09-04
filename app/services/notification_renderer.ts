import { readNotificationPayload } from '#services/notification_payload'

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

const PERSONALIZERS: Record<string, Personalizer> = {}

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
