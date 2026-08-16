import db from '@adonisjs/lucid/services/db'

/**
 * `pending` n'est **pas** stocké : `member_responses.is_available` est un booléen
 * `NOT NULL DEFAULT false` sur une clé `(member_id, event_id)`, donc le troisième
 * état n'existe que par l'absence de ligne.
 *
 * ⚠️ Ne jamais dériver « n'a pas répondu » de `is_available = false` : c'est une
 * abstention explicite. Envoyer « tu n'as pas encore répondu » à quelqu'un qui a
 * répondu *non* est le bug le plus visible que les rappels puissent produire.
 *
 * ⚠️ Corollaire pour toute écriture : `defaultTo(false)` fait qu'une ligne créée
 * sans passer `is_available` inscrit une abstention. Créer la ligne n'est jamais
 * neutre — seule son absence l'est.
 */
export type PresenceState = 'pending' | 'in' | 'out'

export async function presenceStates(eventId: number): Promise<Map<number, PresenceState>> {
  const members = await db.from('members').select('id')
  const responses = await db
    .from('member_responses')
    .where('event_id', eventId)
    .select('member_id', 'is_available')

  const answered = new Map<number, PresenceState>()
  for (const row of responses) {
    answered.set(Number(row.member_id), row.is_available ? 'in' : 'out')
  }

  const states = new Map<number, PresenceState>()
  for (const member of members) {
    const id = Number(member.id)
    states.set(id, answered.get(id) ?? 'pending')
  }

  return states
}
