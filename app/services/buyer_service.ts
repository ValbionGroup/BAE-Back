import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export const ANONYMOUS_BUYER = 'Anonyme'

export type BuyerFastPass = {
  label: string
  /** ISO 8601. Dérivé, jamais stocké — voir `fastPassOf`. */
  validUntil: string
}

export type Buyer = {
  userId: number
  name: string
  fastPass: BuyerFastPass | null
}

/**
 * Point d'entrée unique : le jour où `first_name`/`last_name` remonteront de
 * `members` vers `users`, ou où la table `clients` existera, seul ce fichier
 * changera. `null` rend « Anonyme » — au comptoir, c'est le cas courant.
 */
export async function resolveBuyerNames(
  userIds: readonly number[],
  trx?: TransactionClientContract
): Promise<Map<number, string>> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return new Map()

  const rows = await (trx ?? db)
    .from('members')
    .whereIn('id', unique)
    .select('id', 'first_name', 'last_name')

  const names = new Map<number, string>()
  for (const row of rows) {
    names.set(Number(row.id), `${row.first_name} ${row.last_name}`.trim())
  }

  // « Anonyme » signifie « personne n'a été désigné », pas « inconnu » : un id
  // sans ligne `members` (possible dès que `clients` existera) garde un libellé.
  for (const id of unique) {
    if (!names.has(id)) names.set(id, `Client #${id}`)
  }

  return names
}

export async function resolveBuyerName(
  userId: number | null,
  trx?: TransactionClientContract
): Promise<string> {
  if (userId === null) return ANONYMOUS_BUYER
  const names = await resolveBuyerNames([userId], trx)
  return names.get(userId) ?? ANONYMOUS_BUYER
}

/**
 * ⚠️ La validité n'est pas stockée : `subscribed_at + duration` jours. Calcul
 * centralisé ici, la page `adherents` en étant l'autre consommateur. En cas de
 * chevauchement, c'est l'abonnement qui expire le plus tard qui compte.
 */
export async function fastPassOf(
  userId: number,
  now: DateTime = DateTime.now()
): Promise<BuyerFastPass | null> {
  const rows = await db
    .from('subscriptions')
    .join('fast_passes', 'fast_passes.id', 'subscriptions.fast_pass_id')
    .where('subscriptions.user_id', userId)
    .select('fast_passes.label', 'fast_passes.duration', 'subscriptions.subscribed_at')

  let best: BuyerFastPass | null = null
  let bestEnd: DateTime | null = null

  for (const row of rows) {
    const start = DateTime.fromJSDate(new Date(row.subscribed_at))
    if (!start.isValid) continue

    const end = start.plus({ days: Number(row.duration) })
    if (end <= now) continue

    if (bestEnd === null || end > bestEnd) {
      bestEnd = end
      best = { label: String(row.label), validUntil: end.toISO()! }
    }
  }

  return best
}

/** Identité affichable au comptoir : nom et couverture fast pass. */
export async function describeBuyer(userId: number): Promise<Buyer> {
  const [name, fastPass] = await Promise.all([resolveBuyerName(userId), fastPassOf(userId)])
  return { userId, name, fastPass }
}

/**
 * Chemin dégradé du comptoir, et il n'est pas facultatif : `BarcodeDetector`
 * n'existe ni sous Firefox ni sous Safari, la caméra exige HTTPS, et le
 * téléphone du client peut être déchargé.
 */
export async function searchBuyers(query: string, limit = 10): Promise<Buyer[]> {
  const term = query.trim()
  if (term.length < 2) return []

  const rows = await db
    .from('members')
    .whereILike('first_name', `%${term}%`)
    .orWhereILike('last_name', `%${term}%`)
    .orderBy('last_name')
    .limit(limit)
    .select('id', 'first_name', 'last_name')

  return Promise.all(
    rows.map(async (row) => ({
      userId: Number(row.id),
      name: `${row.first_name} ${row.last_name}`.trim(),
      fastPass: await fastPassOf(Number(row.id)),
    }))
  )
}
