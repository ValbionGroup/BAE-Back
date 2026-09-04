import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { PRESENCE_PENDING, queuePresenceReminders } from '#services/presence_reminder_service'
import type { ReminderKind, ReminderReport } from '#services/presence_reminder_service'

/**
 * Détecte et met en file ; c'est `notify:dispatch` qui envoie.
 *
 * ⚠️ Vise les membres **sans ligne** `member_responses`, jamais ceux dont
 * `is_available` vaut `false` : ceux-là ont répondu *non*, et leur écrire « tu
 * n'as pas encore répondu » est le bug le plus visible que ce rappel puisse
 * produire. La distinction vit dans `presenceStates` (§19).
 */
export abstract class NotifyPresenceBase extends BaseCommand {
  static options: CommandOptions = { startApp: true }

  protected abstract kind: ReminderKind

  /**
   * Redéfini par les sous-classes. Le défaut ne peut pas vivre sur le décorateur :
   * `@flags.number` est une métadonnée **statique** de la classe, qu'une
   * sous-classe ne surcharge pas.
   */
  protected defaultDays = 3

  @flags.number({ description: 'Fenêtre en jours avant la soirée' })
  declare days: number

  @flags.boolean({ description: 'Affiche ce qui serait mis en file sans rien écrire' })
  declare dryRun: boolean

  async run() {
    const days = this.days ?? this.defaultDays
    const reports = await queuePresenceReminders(this.kind, days, { dryRun: this.dryRun })

    if (reports.length === 0) {
      this.logger.info('Aucune soirée concernée dans la fenêtre.')
      return
    }

    for (const report of reports) {
      this.logger.info(this.dryRun ? this.describeDryRun(report) : this.describeRun(report))
    }
  }

  private describeDryRun(report: ReminderReport): string {
    return `[dry-run] ${report.eventName} — ${report.candidates} destinataire(s)`
  }

  private describeRun(report: ReminderReport): string {
    return `${report.eventName} : ${report.created} mise(s) en file, ${report.skipped} déjà connue(s)`
  }
}

export default class NotifyPresencePending extends NotifyPresenceBase {
  static commandName = 'notify:presence-pending'
  static description = 'Rappelle de répondre aux membres sans réponse sur une soirée proche'

  protected kind = PRESENCE_PENDING
}
