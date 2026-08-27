import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

/**
 * `request_logger_middleware` écrit une ligne par requête HTTP. Sans purge la
 * table ne fait que grossir, et avec elle le `COUNT(*)` que lance la pagination
 * de `LogsController.index` — un journal qui se ralentit à mesure qu'il se
 * remplit.
 *
 * La suppression est **découpée en lots**. Un `DELETE` unique sur des mois
 * d'historique tiendrait une transaction longue et ferait gonfler le WAL ;
 * par tranches, chacune s'engage seule et laisse respirer l'autovacuum.
 */
const BATCH_SIZE = 5_000

export default class LogsPrune extends BaseCommand {
  static commandName = 'logs:prune'
  static description = 'Supprime les entrées du journal HTTP plus vieilles que la rétention'
  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Fenêtre de rétention en jours (défaut : LOG_RETENTION_DAYS)' })
  declare days: number

  @flags.boolean({
    description: 'Compte ce qui serait supprimé sans rien écrire',
    default: false,
  })
  declare dryRun: boolean

  async run() {
    const days = this.days ?? env.get('LOG_RETENTION_DAYS', 30)

    if (!Number.isFinite(days) || days < 1) {
      this.logger.error(`Rétention invalide : ${days}. Attendu un entier ≥ 1.`)
      this.exitCode = 1
      return
    }

    const cutoff = DateTime.now().minus({ days })

    if (this.dryRun) {
      const [row] = await db
        .from('logs')
        .where('created_at', '<', cutoff.toSQL()!)
        .count('* as total')
      this.logger.info(
        `${Number(row.total)} entrée(s) antérieure(s) au ${cutoff.toISODate()} seraient supprimées.`
      )
      return
    }

    let deleted = 0
    for (;;) {
      // `whereIn` sur un sous-ensemble borné plutôt qu'un LIMIT sur le DELETE :
      // Postgres n'accepte pas `DELETE ... LIMIT`.
      const batch = await db
        .from('logs')
        .where('created_at', '<', cutoff.toSQL()!)
        .limit(BATCH_SIZE)
        .select('id')

      if (batch.length === 0) break

      // `Number(...)` comme dans `lydia_expire` : Lucid type le retour de
      // `.delete()` plus largement que ce que rend le driver, qui donne le
      // nombre de lignes touchées.
      const removed = await db
        .from('logs')
        .whereIn(
          'id',
          batch.map((r) => r.id)
        )
        .delete()
      deleted += Number(removed)

      if (batch.length < BATCH_SIZE) break
    }

    this.logger.info(`${deleted} entrée(s) supprimée(s), antérieures au ${cutoff.toISODate()}.`)
  }
}
