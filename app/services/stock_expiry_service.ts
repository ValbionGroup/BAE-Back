import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Good from '#models/good'
import { loadBatchesWithRemaining } from '#services/stock_service'
import { emit, recordEvent } from '#services/notification_service'

export const STOCK_EXPIRING = 'stock.expiring'

/**
 * Le récapitulatif ne parle d'aucune denrée en particulier, mais `subject_id`
 * est `NOT NULL`. Le zéro est un **sentinelle assumé**, pas un identifiant :
 * inventer celui du premier lot ferait croire que le fait porte sur lui, et le
 * fil d'activité y renverrait.
 */
const NO_SUBJECT = 0

export type ExpiringBatch = {
  batchId: number
  label: string
  goodName: string
  unit: string
  remainingQty: number
  expirationDate: DateTime
  expired: boolean
}

export type ExpiryReport = {
  /** Lots retenus — ce que `--dry-run` annonce. */
  candidates: number
  created: number
  skipped: number
}

/** Les membres à qui la péremption des stocks s'adresse. Même patron que les
 *  destinataires du support (`ticket:read`). */
async function stockRecipients(): Promise<number[]> {
  const rows = await db
    .from('members')
    .join('roles_permissions', 'roles_permissions.role_id', 'members.role_id')
    .where('roles_permissions.permission_id', 'stock:read')
    .distinct('members.id')
    .select('members.id')

  return rows.map((row) => Number(row.id))
}

/**
 * Les lots qui périment bientôt, **et ceux qui ont déjà périmé** : un lot passé
 * est le cas le plus urgent, l'exclure ne préviendrait que de ce qui n'est pas
 * encore un problème.
 *
 * ⚠️ Passe par `loadBatchesWithRemaining` plutôt que par une requête agrégée.
 * La quantité restante n'est jamais stockée, elle se dérive des mouvements, et
 * cette formule doit rester à un seul endroit (`stock_service`). Deux
 * conséquences gratuites : les **lots vides sont exclus** — un lot consommé ne
 * périme pas — et l'ordre FEFO est déjà celui de la lecture.
 *
 * Le N+1 est délibéré, comme pour l'inventaire imprimé : le catalogue du BAE
 * compte quelques dizaines de denrées et ceci tourne une fois par jour.
 */
export async function expiringBatches(
  days: number,
  now: DateTime = DateTime.now()
): Promise<ExpiringBatch[]> {
  const horizon = now.plus({ days })
  const goods = await Good.query().orderBy('name')
  const expiring: ExpiringBatch[] = []

  for (const good of goods) {
    const batches = await loadBatchesWithRemaining(good.id, false)

    for (const batch of batches) {
      if (batch.expirationDate === null) continue
      if (batch.expirationDate > horizon) continue

      expiring.push({
        batchId: batch.id,
        label: batch.label,
        goodName: good.name,
        unit: good.unit,
        remainingQty: batch.remainingQty,
        expirationDate: batch.expirationDate,
        expired: batch.expirationDate < now,
      })
    }
  }

  // Le plus urgent en tête : c'est l'ordre dans lequel on vide un frigo.
  return expiring.sort((a, b) => a.expirationDate.toMillis() - b.expirationDate.toMillis())
}

function describe(batch: ExpiringBatch): string {
  const dlc = batch.expirationDate.setLocale('fr').toFormat('dd/LL/yyyy')
  const state = batch.expired ? 'périmé' : `DLC ${dlc}`
  return `${batch.goodName} — lot ${batch.label} — ${batch.remainingQty} ${batch.unit} — ${state}`
}

/**
 * Détecte et met en file, mais **n'envoie pas** : l'envoi est le rôle de
 * `notify:dispatch`.
 *
 * Un seul récapitulatif par jour, d'où un `dedupeKey` daté. Ce choix porte la
 * politique de relance : le rappel **repart chaque jour** tant que des lots
 * restent à traiter. Une clé par lot ne préviendrait qu'une fois, et un lot
 * ignoré périmerait en silence.
 */
export async function queueStockExpiryReminder(
  days: number,
  options: { dryRun?: boolean } = {},
  now: DateTime = DateTime.now()
): Promise<ExpiryReport> {
  const batches = await expiringBatches(days, now)

  if (batches.length === 0) {
    return { candidates: 0, created: 0, skipped: 0 }
  }

  // Le `--dry-run` sort **ici**, après la sélection et avant l'écriture : la
  // liste annoncée est exactement celle qui partirait.
  if (options.dryRun === true) {
    return { candidates: batches.length, created: 0, skipped: 0 }
  }

  const expiredCount = batches.filter((batch) => batch.expired).length
  const fact = {
    verb: STOCK_EXPIRING,
    subjectType: 'stock',
    subjectId: NO_SUBJECT,
    payload: {
      subject:
        expiredCount > 0
          ? `${expiredCount} lot(s) périmé(s), ${batches.length} à traiter`
          : `${batches.length} lot(s) approchent de leur DLC`,
      lines: batches.map(describe),
      expiredCount,
      totalCount: batches.length,
    },
    dedupeKey: `${STOCK_EXPIRING}:${now.toISODate()}`,
  } as const

  const recipients = await stockRecipients()

  // ⚠️ Le fait est enregistré **même sans destinataire** : la péremption a lieu,
  // qu'on la notifie ou non. Même raisonnement que l'ouverture d'un ticket.
  if (recipients.length === 0) {
    await recordEvent(fact)
    return { candidates: batches.length, created: 0, skipped: 0 }
  }

  // `in_app` autant que `mail` : sans SMTP le courrier dort en file, et c'est la
  // cloche de l'application qui rend le rappel utilisable aujourd'hui.
  const result = await emit({ ...fact, recipients, channels: ['in_app', 'mail'] })

  return { candidates: batches.length, created: result.created, skipped: result.skipped }
}
