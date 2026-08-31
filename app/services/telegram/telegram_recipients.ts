import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'

/** Le **seul** endroit qui sache où est rangé le chat id. */
export async function telegramLinkedAmong(
  userIds: readonly number[],
  trx?: TransactionClientContract
): Promise<Set<number>> {
  if (userIds.length === 0) return new Set()

  const rows = await (trx ?? db)
    .from('users')
    .whereIn('id', [...new Set(userIds)])
    .whereNotNull('telegram_chat_id')
    .select('id')

  return new Set(rows.map((row) => Number(row.id)))
}
