import type { ReceivedUpdate, SendOutcome } from './telegram_payload.js'

/**
 * `sendMessage` rend un résultat là où `LydiaClient` lève : le distributeur doit
 * distinguer « ce chat ne recevra plus jamais rien » de « réessaie plus tard »,
 * deux décisions opposées sur `sent_at`. Les autres méthodes lèvent, leurs
 * appelants n'ayant rien à arbitrer.
 */
export default abstract class TelegramClient {
  abstract sendMessage(chatId: number, text: string): Promise<SendOutcome>
  abstract getUpdates(input: { offset: number; timeoutSeconds: number }): Promise<ReceivedUpdate[]>
  abstract setWebhook(input: { url: string; secretToken: string }): Promise<void>
  abstract deleteWebhook(): Promise<void>
}
