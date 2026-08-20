import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

export default class LydiaExpire extends BaseCommand {
  static commandName = 'lydia:expire'
  static description = 'Marque expirées les demandes de paiement dépassées'
  static options: CommandOptions = { startApp: true }

  async run() {
    const now = DateTime.now()

    const expired = await db
      .from('payments')
      .where('status', 'pending')
      .whereNotNull('expires_at')
      .where('expires_at', '<', now.toSQL()!)
      .update({ status: 'expired', updated_at: now.toSQL() })

    this.logger.info(`${Number(expired)} demande(s) expirée(s).`)
  }
}
