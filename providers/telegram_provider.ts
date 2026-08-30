import type { ApplicationService } from '@adonisjs/core/types'
import TelegramClient from '#services/telegram/telegram_client'
import HttpTelegramClient from '#services/telegram/http_telegram_client'
import FakeTelegramClient from '#services/telegram/fake_telegram_client'
import telegramConfig from '#config/telegram'

export default class TelegramProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(TelegramClient, () =>
      telegramConfig.driver === 'fake'
        ? new FakeTelegramClient()
        : new HttpTelegramClient(telegramConfig.apiUrl, telegramConfig.botToken)
    )
  }
}
