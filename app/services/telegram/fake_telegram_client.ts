import TelegramClient from './telegram_client.js'
import type { ReceivedUpdate, SendOutcome } from './telegram_payload.js'

/** Le seul Telegram que connaissent les tests, et celui du développement local. */
export default class FakeTelegramClient extends TelegramClient {
  readonly sent: { chatId: number; text: string }[] = []

  /** Ce que rendra le prochain `getUpdates`, une seule fois. */
  pending: ReceivedUpdate[] = []

  webhook: { url: string; secretToken: string } | null = null

  /** Force l'issue du prochain envoi, pour éprouver blocage et limitation. */
  nextSendOutcome: SendOutcome | null = null

  async sendMessage(chatId: number, text: string): Promise<SendOutcome> {
    const forced = this.nextSendOutcome
    if (forced !== null) {
      this.nextSendOutcome = null
      return forced
    }

    this.sent.push({ chatId, text })
    return { ok: true }
  }

  async getUpdates(): Promise<ReceivedUpdate[]> {
    const updates = this.pending
    this.pending = []
    return updates
  }

  async setWebhook(input: { url: string; secretToken: string }): Promise<void> {
    this.webhook = input
  }

  async deleteWebhook(): Promise<void> {
    this.webhook = null
  }
}
