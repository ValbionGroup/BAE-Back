import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export const ANONYMOUS_BUYER = 'Anonyme'

/**
 * Résout le nom affichable d'un acheteur à partir de son `users.id`.
 *
 * **Point d'entrée unique, et c'est délibéré.** Le §4.4 du dossier laisse ouverte
 * la question de remonter `first_name` / `last_name` de `members` vers `users`
 * (Keycloak les fournit de toute façon à la connexion). Concentrer la résolution
 * ici fait que cette décision, quand elle tombera, ne touchera qu'un fichier —
 * et il en ira de même le jour où la table `clients` existera.
 *
 * `null` rend « Anonyme » : au comptoir, une commande sans acheteur désigné est
 * le cas courant, pas une anomalie.
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

  // Un `users` sans ligne `members` est aujourd'hui impossible, mais le sera dès
  // que `clients` existera : on nomme la personne plutôt que de rendre « Anonyme »,
  // qui signifie « personne n'a été désigné » et non « je ne sais pas qui c'est ».
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
