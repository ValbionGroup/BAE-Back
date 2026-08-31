import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import Notification from '#models/notification'
import TelegramClient from '#services/telegram/telegram_client'
import { unlink } from '#services/telegram/telegram_link_service'
import { readNotificationPayload } from '#services/notification_payload'

/**
 * Distincte de `notify:dispatch`, qui n'entoure pas `mail.send` d'un try/catch :
 * là-bas une panne SMTP avorte volontairement la commande, ici un blocage sur un
 * destinataire ne doit pas priver les autres.
 */
export default class TelegramDispatch extends BaseCommand {
  static commandName = 'telegram:dispatch'
  static description = 'Envoie les notifications Telegram en attente et les horodate'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Affiche ce qui serait envoyé sans rien écrire', default: false })
  declare dryRun: boolean

  async run() {
    const pending = await db
      .from('notifications')
      .join('activity_events', 'activity_events.id', 'notifications.event_id')
      .join('users', 'users.id', 'notifications.user_id')
      .whereNull('notifications.sent_at')
      .where('notifications.channel', 'telegram')
      .whereNotNull('users.telegram_chat_id')
      .select(
        'notifications.id as id',
        'users.id as user_id',
        'users.telegram_chat_id as chat_id',
        'activity_events.payload as payload'
      )

    if (pending.length === 0) {
      this.logger.info('Aucune notification Telegram en attente.')
      return
    }

    const telegram = await app.container.make(TelegramClient)
    let sent = 0

    for (const row of pending) {
      const { subject, lines } = readNotificationPayload(row.payload)
      const text = [subject, ...lines].join('\n')
      const chatId = Number(row.chat_id)

      if (this.dryRun) {
        this.logger.info(`[dry-run] ${chatId} — ${subject}`)
        continue
      }

      const outcome = await telegram.sendMessage(chatId, text)

      if (!outcome.ok && outcome.kind === 'transient') {
        this.logger.warning(`Envoi différé pour ${chatId} : ${outcome.description}`)
        if (outcome.retryAfterSeconds !== null) break
        continue
      }

      if (!outcome.ok) {
        this.logger.warning(`Compte délié après un refus définitif de Telegram : ${chatId}`)
        await unlink(Number(row.user_id))
      }

      await this.markSent(row.id)
      if (outcome.ok) sent += 1
    }

    this.logger.info(this.dryRun ? `${pending.length} à envoyer.` : `${sent} envoyée(s).`)
  }

  /**
   * Horodaté ligne par ligne juste après l'envoi, comme `notify:dispatch`. Sur un
   * refus définitif, `sent_at` veut dire « la file en a fini » et non « reçu » —
   * le chemin mail a déjà cette sémantique, un SMTP qui accepte ne prouvant rien.
   */
  private async markSent(id: number): Promise<void> {
    await Notification.query().where('id', id).update({ sent_at: DateTime.now().toSQL() })
  }
}
