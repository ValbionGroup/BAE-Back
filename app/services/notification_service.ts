import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import ActivityEvent from '#models/activity_event'
import Notification from '#models/notification'
import type { NotificationChannel } from '#models/notification'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { telegramLinkedAmong } from '#services/telegram/telegram_recipients'

/** Code Postgres d'une violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  )
}

export type EmitInput = {
  verb: string
  actorId?: number | null
  subjectType: string
  subjectId: number
  payload?: Record<string, unknown>
  recipients: readonly number[]
  channels?: readonly NotificationChannel[]
  /** Rend le fait rejouable : deux appels de même clé ne produisent qu'un fait. */
  dedupeKey?: string
}

export type EmitResult = { eventId: number; created: number; skipped: number }

export type RecordInput = Omit<EmitInput, 'recipients' | 'channels'>

/**
 * Enregistre un **fait** sans le livrer à personne.
 *
 * Le fil d'activité est global : il montre ce que l'équipe a fait, il ne
 * s'adresse à personne en particulier. `emit()` sert quand une notification doit
 * partir ; celle-ci quand seul le fait compte. Confondre les deux obligerait à
 * inventer des destinataires pour chaque action tracée.
 */
export async function recordEvent(
  input: RecordInput,
  trx?: TransactionClientContract
): Promise<ActivityEvent | null> {
  if (input.dedupeKey !== undefined) {
    const existing = await ActivityEvent.query(trx ? { client: trx } : {})
      .where('dedupeKey', input.dedupeKey)
      .first()
    if (existing !== null) return existing
  }

  return ActivityEvent.create(
    {
      actorId: input.actorId ?? null,
      verb: input.verb,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      payload: input.payload ?? {},
      occurredAt: DateTime.now(),
      dedupeKey: input.dedupeKey ?? null,
    },
    trx ? { client: trx } : {}
  )
}

/**
 * Un fait sans livraison, ou l'inverse, n'a pas de sens : d'où la transaction.
 *
 * L'idempotence n'est pas testée avant d'écrire — elle est **déléguée à la base**.
 * On tente l'insertion et on rattrape la violation d'unicité : entre un `SELECT`
 * et un `INSERT`, un second processus peut s'intercaler, et c'est exactement ce
 * qu'un cron qui se chevauche produit.
 *
 * ⚠️ Chaque insertion vit dans son propre **SAVEPOINT** (`trx.transaction()`).
 * Sans lui, une violation d'unicité avorterait la transaction entière et toutes
 * les instructions suivantes échoueraient avec `current transaction is aborted` —
 * un doublon ferait donc perdre les destinataires qui le suivent.
 */
export async function emit(input: EmitInput): Promise<EmitResult> {
  const channels = input.channels ?? (['mail'] as const)

  return db.transaction(async (trx) => {
    if (input.dedupeKey !== undefined) {
      const existing = await ActivityEvent.query({ client: trx })
        .where('dedupeKey', input.dedupeKey)
        .first()

      if (existing !== null) {
        return {
          eventId: existing.id,
          created: 0,
          skipped: input.recipients.length * channels.length,
        }
      }
    }

    const event = await ActivityEvent.create(
      {
        actorId: input.actorId ?? null,
        verb: input.verb,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        payload: input.payload ?? {},
        occurredAt: DateTime.now(),
        dedupeKey: input.dedupeKey ?? null,
      },
      { client: trx }
    )

    // Telegram est un miroir de `mail` : `in_app` est un canal d'interface, et le
    // rejouer transformerait chaque trace du fil d'activité en message poussé.
    const telegramReady =
      channels.includes('mail') && input.recipients.length > 0
        ? await telegramLinkedAmong(input.recipients, trx)
        : new Set<number>()

    let created = 0
    let skipped = 0

    for (const userId of input.recipients) {
      const perUser: readonly NotificationChannel[] = telegramReady.has(userId)
        ? [...channels, 'telegram']
        : channels

      for (const channel of perUser) {
        const savepoint = await trx.transaction()
        try {
          await Notification.create(
            { eventId: event.id, userId, channel, sentAt: null, readAt: null },
            { client: savepoint }
          )
          await savepoint.commit()
          created += 1
        } catch (error) {
          await savepoint.rollback()
          if (!isUniqueViolation(error)) throw error
          skipped += 1
        }
      }
    }

    return { eventId: event.id, created, skipped }
  })
}
