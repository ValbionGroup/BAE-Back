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
 * Assemble le nom affichable à partir des colonnes brutes, en miroir du getter
 * `User.fullName` : les deux colonnes sont **nullables** depuis que l'identité
 * vit sur `users`, et un compte créé par inscription directe n'a pas de nom.
 * Concaténer sans filtrer rendrait « null null ».
 */
function joinName(firstName: unknown, lastName: unknown): string | null {
  const parts = [firstName, lastName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part !== '')

  return parts.length > 0 ? parts.join(' ') : null
}

/**
 * Point d'entrée unique de l'identité d'un acheteur. Interroge `users`, et pas
 * `members` : les ids reçus viennent d'`orders.client_id` et de
 * `pre_orders.user_id`, qui référencent tous deux `users`. Passer par `members`
 * ne fonctionnait que par le partage de clé primaire, et ne nommait donc que
 * les acheteurs qui se trouvaient être membres du BAE — le client, précisément
 * la personne qu'on identifie au comptoir, retombait toujours sur `Client #id`.
 *
 * `null` rend « Anonyme » — au comptoir, c'est le cas courant.
 */
export async function resolveBuyerNames(
  userIds: readonly number[],
  trx?: TransactionClientContract
): Promise<Map<number, string>> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return new Map()

  const rows = await (trx ?? db)
    .from('users')
    .whereIn('id', unique)
    .select('id', 'first_name', 'last_name')

  const names = new Map<number, string>()
  for (const row of rows) {
    const name = joinName(row.first_name, row.last_name)
    if (name !== null) names.set(Number(row.id), name)
  }

  // « Anonyme » signifie « personne n'a été désigné », pas « inconnu » : un
  // compte sans nom — inscription directe, ou client dont le SSO n'a pas encore
  // renseigné l'identité — garde un libellé plutôt qu'une case vide.
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
 * Le fast pass désigné par un QR, s'il est encore valide.
 *
 * Un QR de fast pass identifie donc son porteur aussi bien qu'un QR d'identité :
 * ce qu'il ajoute, c'est la preuve du droit. C'est l'échéance qui décide, pas le
 * type du jeton — un pass échu ne vaut plus rien, même signé.
 */
export async function validFastPass(
  userId: number,
  fastPassId: number,
  now: DateTime = DateTime.now()
): Promise<BuyerFastPass | null> {
  const rows = await db
    .from('subscriptions')
    .join('fast_passes', 'fast_passes.id', 'subscriptions.fast_pass_id')
    .where('subscriptions.user_id', userId)
    .where('subscriptions.fast_pass_id', fastPassId)
    .select('fast_passes.label', 'fast_passes.duration', 'subscriptions.subscribed_at')

  for (const row of rows) {
    const start = DateTime.fromJSDate(new Date(row.subscribed_at))
    if (!start.isValid) continue

    const end = start.plus({ days: Number(row.duration) })
    if (end > now) return { label: String(row.label), validUntil: end.toISO()! }
  }

  return null
}

/**
 * Chemin dégradé du comptoir, et il n'est pas facultatif : `BarcodeDetector`
 * n'existe ni sous Firefox ni sous Safari, la caméra exige HTTPS, et le
 * téléphone du client peut être déchargé.
 */
export async function searchBuyers(query: string, limit = 10): Promise<Buyer[]> {
  const term = query.trim()
  if (term.length < 2) return []

  // Sur `users`, donc un client est trouvable au comptoir au même titre qu'un
  // membre. Un compte sans nom ne remonte jamais : `ILIKE` ne matche pas `NULL`,
  // ce qui écarte les inscriptions incomplètes sans avoir à les filtrer.
  const rows = await db
    .from('users')
    .whereILike('first_name', `%${term}%`)
    .orWhereILike('last_name', `%${term}%`)
    .orderBy('last_name')
    .limit(limit)
    .select('id', 'first_name', 'last_name')

  return Promise.all(
    rows.map(async (row) => ({
      userId: Number(row.id),
      name: joinName(row.first_name, row.last_name) ?? `Client #${Number(row.id)}`,
      fastPass: await fastPassOf(Number(row.id)),
    }))
  )
}
