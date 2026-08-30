import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import app from '@adonisjs/core/services/app'
import TelegramClient from '#services/telegram/telegram_client'
import { handleUpdate } from '#services/telegram/telegram_update_service'

/**
 * Le pendant local du webhook : en développement, aucune adresse publique en
 * HTTPS n'est joignable par Telegram.
 *
 * ⚠️ Telegram refuse `getUpdates` (409) tant qu'un webhook est enregistré sur le
 * même bot : les deux modes s'excluent. Utilisez un second bot BotFather pour le
 * développement, ou `node ace telegram:webhook --delete`.
 *
 * L'offset ne vit qu'en mémoire : Telegram garde les mises à jour non confirmées
 * 24 h et `handleUpdate` est idempotent, donc un redémarrage n'en perd aucune.
 */
export default class TelegramPoll extends BaseCommand {
  static commandName = 'telegram:poll'
  static description = 'Interroge Telegram en long polling et traite les mises à jour'
  static options: CommandOptions = { startApp: true, staysAlive: true }

  @flags.boolean({ description: 'Un seul appel à getUpdates, puis sortie', default: false })
  declare once: boolean

  @flags.number({ description: 'Durée du long polling, en secondes', default: 25 })
  declare timeout: number

  async run() {
    if (this.app.inProduction) {
      this.logger.error('En production, c’est le webhook qui reçoit les mises à jour.')
      this.exitCode = 1
      return
    }

    const telegram = await app.container.make(TelegramClient)
    let offset = 0

    do {
      const updates = await telegram.getUpdates({ offset, timeoutSeconds: this.timeout })

      for (const update of updates) {
        await handleUpdate(update.raw)
        offset = update.updateId + 1
      }
    } while (!this.once)

    await this.terminate()
  }
}
