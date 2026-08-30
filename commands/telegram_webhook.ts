import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import app from '@adonisjs/core/services/app'
import telegramConfig from '#config/telegram'
import TelegramClient from '#services/telegram/telegram_client'

/** Sans elle, la mise en service passerait par un `curl` que personne ne retrouve. */
export default class TelegramWebhook extends BaseCommand {
  static commandName = 'telegram:webhook'
  static description = 'Enregistre ou retire le webhook Telegram'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Retire le webhook au lieu de l’enregistrer', default: false })
  declare delete: boolean

  async run() {
    const telegram = await app.container.make(TelegramClient)

    if (this.delete) {
      await telegram.deleteWebhook()
      this.logger.success('Webhook retiré. `telegram:poll` est de nouveau utilisable.')
      return
    }

    const url = `${telegramConfig.webhookBaseUrl}/v1/telegram/webhook`
    await telegram.setWebhook({ url, secretToken: telegramConfig.webhookSecret })
    this.logger.success(`Webhook enregistré sur ${url}`)
  }
}
