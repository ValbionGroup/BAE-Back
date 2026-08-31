import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import TelegramClient from './telegram_client.js'
import { parseUpdate } from './telegram_payload.js'
import { redeemLinkCode, unlink } from './telegram_link_service.js'
import { NOT_LINKED, START_WITHOUT_CODE, UNLINKED, redeemReply } from './telegram_messages.js'

/**
 * Le point d'entrée unique d'une mise à jour Telegram, partagé mot pour mot par
 * le webhook et `telegram:poll` — c'est ce qui garantit que le chemin éprouvé en
 * développement est celui de la production.
 *
 * Prend `unknown` à dessein : les deux transports passent le JSON tel que
 * Telegram l'a écrit, sans qu'aucun n'ait à le préparer. Ne lève jamais.
 */
export async function handleUpdate(raw: unknown): Promise<void> {
  const command = parseUpdate(raw)
  if (command === null) return

  const telegram = await app.container.make(TelegramClient)
  const reply = await replyFor(command)

  await telegram.sendMessage(command.chatId, reply)
}

async function replyFor(command: NonNullable<ReturnType<typeof parseUpdate>>): Promise<string> {
  if (command.command === 'stop') return await stop(command.chatId)
  if (command.argument === null) return START_WITHOUT_CODE

  const outcome = await redeemLinkCode({
    code: command.argument,
    chatId: command.chatId,
    username: command.username,
  })

  logger.info({ chatId: command.chatId, outcome: outcome.kind }, 'liaison Telegram')
  return redeemReply(outcome)
}

/**
 * ⚠️ `telegram_chat_id` est un `bigint`, rendu en **string** par le driver `pg` :
 * la comparaison passe par la chaîne, jamais par le nombre.
 */
async function stop(chatId: number): Promise<string> {
  const user = await User.query().where('telegramChatId', String(chatId)).first()
  if (user === null) return NOT_LINKED

  await unlink(user.id)
  return UNLINKED
}
