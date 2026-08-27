import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { queueStockExpiryReminder } from '#services/stock_expiry_service'

/**
 * Détecte et met en file ; c'est `notify:dispatch` qui envoie.
 *
 * ⚠️ Aucun planificateur ne vit dans ce dépôt : cette commande attend d'être
 * lancée une fois par jour par le déploiement (cf. tâche 58). Sans cela elle ne
 * tourne jamais, et le rappel n'existe que sur le papier.
 */
export default class NotifyStockExpiring extends BaseCommand {
  static commandName = 'notify:stock-expiring'
  static description = 'Récapitule les lots périmés ou proches de leur DLC'
  static options: CommandOptions = { startApp: true }

  /** 7 jours : le seuil `soon` qu'emploie déjà `computeGoodStockSummary`, donc
   *  le même « proche péremption » que celui affiché dans l'écran Stocks. */
  @flags.number({ description: 'Fenêtre en jours avant la DLC', default: 7 })
  declare days: number

  @flags.boolean({ description: 'Affiche ce qui serait mis en file sans rien écrire' })
  declare dryRun: boolean

  async run() {
    const report = await queueStockExpiryReminder(this.days, { dryRun: this.dryRun })

    if (report.candidates === 0) {
      this.logger.info('Aucun lot périmé ni proche de sa DLC.')
      return
    }

    if (this.dryRun) {
      this.logger.info(`[dry-run] ${report.candidates} lot(s) au récapitulatif`)
      return
    }

    this.logger.info(
      `${report.candidates} lot(s) au récapitulatif : ${report.created} mise(s) en file, ${report.skipped} déjà connue(s)`
    )
  }
}
