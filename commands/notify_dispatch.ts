import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import Notification from '#models/notification'
import { PresenceReminderNotification } from '#mails/presence_reminder_notification'
import { readNotificationPayload } from '#services/notification_payload'
import { renderDeliveries } from '#services/notification_renderer'

/**
 * Vidange la file. Séparée des détecteurs à dessein : un SMTP indisponible ne
 * doit pas faire perdre la détection, et chaque moitié se teste sans l'autre —
 * celle-ci sans horloge ni données métier, les détecteurs sans SMTP.
 */
export default class NotifyDispatch extends BaseCommand {
  static commandName = 'notify:dispatch'
  static description = 'Envoie les notifications en attente et les horodate'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Affiche ce qui serait envoyé sans rien écrire', default: false })
  declare dryRun: boolean

  async run() {
    const pending = await db
      .from('notifications')
      .join('activity_events', 'activity_events.id', 'notifications.event_id')
      .join('users', 'users.id', 'notifications.user_id')
      .whereNull('notifications.sent_at')
      .where('notifications.channel', 'mail')
      .select(
        'notifications.id as id',
        'notifications.user_id as user_id',
        'users.email as email',
        'activity_events.verb as verb',
        'activity_events.subject_id as subject_id',
        'activity_events.payload as payload'
      )

    if (pending.length === 0) {
      this.logger.info('Aucune notification en attente.')
      return
    }

    const rendered = await renderDeliveries(
      pending.map((row) => ({
        id: Number(row.id),
        userId: Number(row.user_id),
        verb: String(row.verb),
        subjectId: Number(row.subject_id),
        payload: row.payload,
      }))
    )

    let sent = 0

    for (const row of pending) {
      const { subject, lines } =
        rendered.get(Number(row.id)) ?? readNotificationPayload(row.payload)

      if (this.dryRun) {
        this.logger.info(`[dry-run] ${row.email} — ${subject}`)
        continue
      }

      await mail.send(new PresenceReminderNotification(row.email, subject, lines))

      // Horodaté une ligne à la fois, juste après son envoi : un échec au milieu
      // ne doit pas faire repartir au prochain passage les messages déjà partis.
      await Notification.query().where('id', row.id).update({ sent_at: DateTime.now().toSQL() })
      sent += 1
    }

    this.logger.info(this.dryRun ? `${pending.length} à envoyer.` : `${sent} envoyée(s).`)
  }
}
