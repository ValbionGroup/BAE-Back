import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

/**
 * L'écrasante majorité des demandes de paiement n'aboutit jamais. Sans passage
 * régulier, la table se remplit de `pending` éternels et plus rien ne distingue
 * l'abandonné de l'en-cours — ni pour le rapprochement, ni pour le diagnostic.
 *
 * ⚠️ N'interroge pas Lydia. Une demande dont le délai est passé ne peut plus
 * être payée : c'est `expire_time`, envoyé à la création, qui fait foi des deux
 * côtés. Un aller-retour réseau par ligne n'apprendrait rien.
 */
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
