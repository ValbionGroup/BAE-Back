import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import TelegramLinkCode from '#models/telegram_link_code'
import telegramConfig from '#config/telegram'
import { digest, normaliseLinkCode, randomLinkCode } from '#services/token_digest'

/**
 * ⚠️ Affichée à l'utilisateur par la zone publique. Les deux dépôts ne partagent
 * rien à la compilation : changer cette valeur impose de changer le texte du front.
 */
export const TELEGRAM_LINK_TTL_MINUTES = 15

export type IssuedLinkCode = {
  code: string
  url: string
  botUsername: string
  expiresAt: DateTime
}

export type RedeemOutcome =
  | { kind: 'linked'; userId: number }
  | { kind: 'already_linked_here' }
  | { kind: 'unknown_code' }
  | { kind: 'expired' }
  | { kind: 'chat_taken' }

/** Code Postgres d'une violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  )
}

/**
 * Émet un code neuf et périme les précédents du même compte, comme le fait déjà
 * `requestReset()` : deux liens vivants pour une seule personne n'ont aucun sens.
 */
export async function issueLinkCode(userId: number): Promise<IssuedLinkCode> {
  const code = randomLinkCode()
  const expiresAt = DateTime.now().plus({ minutes: TELEGRAM_LINK_TTL_MINUTES })

  await db.transaction(async (trx) => {
    await TelegramLinkCode.query({ client: trx })
      .where('userId', userId)
      .whereNull('usedAt')
      .update({ used_at: DateTime.now().toSQL() })

    await TelegramLinkCode.create(
      { userId, codeDigest: digest(normaliseLinkCode(code)), expiresAt },
      { client: trx }
    )
  })

  return {
    code,
    url: `https://t.me/${telegramConfig.botUsername}?start=${code}`,
    botUsername: telegramConfig.botUsername,
    expiresAt,
  }
}

/**
 * ⚠️ « Expiré » est testé **avant** « déjà utilisé » : c'est le message utile, et
 * dire « déjà utilisé » d'un code périmé serait trompeur.
 *
 * Un `chat_id` déjà pris fait tout annuler, **code compris** : la personne peut
 * délier l'autre profil puis recliquer le même lien.
 */
export async function redeemLinkCode(input: {
  code: string
  chatId: number
  username: string | null
}): Promise<RedeemOutcome> {
  const codeDigest = digest(normaliseLinkCode(input.code))
  const row = await TelegramLinkCode.findBy('codeDigest', codeDigest)

  if (row === null) return { kind: 'unknown_code' }
  if (row.expiresAt < DateTime.now()) return { kind: 'expired' }

  if (row.usedAt !== null) return await replayOf(row.userId, input.chatId)

  try {
    return await db.transaction(async (trx) => {
      // La prise de verrou est l'écriture elle-même : lire puis écrire laisserait
      // deux traitements concurrents passer la même vérification.
      const claimed = await TelegramLinkCode.query({ client: trx })
        .where('id', row.id)
        .whereNull('usedAt')
        .update({ used_at: DateTime.now().toSQL() })

      if (Number(claimed) === 0) return await replayOf(row.userId, input.chatId)

      const user = await User.query({ client: trx }).where('id', row.userId).firstOrFail()
      user.telegramChatId = input.chatId
      user.telegramLinkedAt = DateTime.now()
      if (input.username !== null) user.telegramHandle = input.username
      await user.save()

      return { kind: 'linked', userId: row.userId }
    })
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return { kind: 'chat_taken' }
    throw error
  }
}

/**
 * Délie et rend l'ancien `chat_id`, pour que l'appelant puisse dire au revoir.
 *
 * ⚠️ `telegram_chat_id` est un `bigint` : le driver `pg` le rend en **string**.
 */
export async function unlink(userId: number): Promise<number | null> {
  const user = await User.find(userId)
  if (user === null) return null

  const previous = user.telegramChatId
  user.telegramChatId = null
  user.telegramLinkedAt = null
  await user.save()

  await TelegramLinkCode.query()
    .where('userId', userId)
    .whereNull('usedAt')
    .update({ used_at: DateTime.now().toSQL() })

  return previous === null ? null : Number(previous)
}

/** Un lien recliqué depuis le même chat n'est pas une erreur : c'est un doublon. */
async function replayOf(userId: number, chatId: number): Promise<RedeemOutcome> {
  const user = await User.find(userId)
  const linked = user?.telegramChatId

  return linked !== null && linked !== undefined && String(linked) === String(chatId)
    ? { kind: 'already_linked_here' }
    : { kind: 'unknown_code' }
}
