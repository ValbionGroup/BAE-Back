import logger from '@adonisjs/core/services/logger'
import ApiException from '#exceptions/api_exception'
import { describeFetchFailure } from '#services/lydia/http_lydia_client'
import TelegramClient from './telegram_client.js'
import { classifySendFailure, type ReceivedUpdate, type SendOutcome } from './telegram_payload.js'

/** Plafond d'un message Telegram. Au-delà, l'API refuse tout l'envoi. */
const MAX_MESSAGE_LENGTH = 4096

export default class HttpTelegramClient extends TelegramClient {
  constructor(
    private readonly apiUrl: string,
    private readonly botToken: string
  ) {
    super()
  }

  /**
   * Sans `parse_mode` : MarkdownV2 échoue en 400 sur un `.`, un `-` ou un `!` non
   * échappé, et le sujet d'un ticket est saisi par l'utilisateur.
   */
  async sendMessage(chatId: number, text: string): Promise<SendOutcome> {
    const response = await this.post('sendMessage', {
      chat_id: chatId,
      text: text.slice(0, MAX_MESSAGE_LENGTH),
    })

    if (response.ok) return { ok: true }

    const failure = classifySendFailure(response.status, response.body)
    logger.warn({ chatId, ...failure }, 'envoi Telegram refusé')
    return { ok: false, ...failure }
  }

  async getUpdates(input: { offset: number; timeoutSeconds: number }): Promise<ReceivedUpdate[]> {
    const response = await this.post('getUpdates', {
      offset: input.offset,
      timeout: input.timeoutSeconds,
      allowed_updates: ['message'],
    })

    if (!response.ok) {
      throw new ApiException(
        'E_TELEGRAM_UNREACHABLE',
        `Telegram a répondu ${response.status}.`,
        502
      )
    }

    const result = (response.body as { result?: unknown }).result
    if (!Array.isArray(result)) return []

    return result.map((raw) => ({
      updateId: Number((raw as { update_id: number }).update_id),
      raw,
    }))
  }

  async setWebhook(input: { url: string; secretToken: string }): Promise<void> {
    await this.expectOk('setWebhook', {
      url: input.url,
      secret_token: input.secretToken,
      allowed_updates: ['message'],
    })
  }

  async deleteWebhook(): Promise<void> {
    await this.expectOk('deleteWebhook', {})
  }

  private async expectOk(method: string, body: Record<string, unknown>): Promise<void> {
    const response = await this.post(method, body)
    if (!response.ok) {
      throw new ApiException(
        'E_TELEGRAM_UNREACHABLE',
        `Telegram a répondu ${response.status} à ${method}.`,
        502
      )
    }
  }

  private async post(
    method: string,
    body: Record<string, unknown>
  ): Promise<{ ok: boolean; status: number; body: unknown }> {
    const url = `${this.apiUrl}/bot${this.botToken}/${method}`

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (error) {
      logger.error({ err: error, method }, `Telegram injoignable : ${describeFetchFailure(error)}`)
      throw new ApiException('E_TELEGRAM_UNREACHABLE', 'Telegram est injoignable.', 502)
    }

    const parsed = await response.json().catch(() => ({}))
    return { ok: response.ok, status: response.status, body: parsed }
  }
}
