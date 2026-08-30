import { timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import telegramConfig from '#config/telegram'
import { handleUpdate } from '#services/telegram/telegram_update_service'

/**
 * ⚠️ `timingSafeEqual` lève sur deux tampons de longueurs différentes : comparer
 * les tailles d'abord n'est pas une optimisation, c'est ce qui évite une 500.
 */
function secretMatches(received: string | undefined): boolean {
  if (received === undefined) return false

  const expected = Buffer.from(telegramConfig.webhookSecret)
  const candidate = Buffer.from(received)

  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

export default class TelegramWebhookController {
  /**
   * ⚠️ Lit `request.raw()` et **jamais** `request.body()` :
   * `case_converter_middleware` s'applique à toutes les routes et camélifierait
   * les clés, alors que `getUpdates` — qui ne passe pas par lui — les livre en
   * snake_case. Les deux transports cesseraient de voir la même chose, en silence.
   *
   * 403 sur secret invalide : l'appelant n'est alors pas Telegram, il n'y a aucune
   * réémission à calmer, et un 204 masquerait une erreur de configuration. 204
   * partout ailleurs, comme les callbacks de paiement — une erreur ferait retenter
   * Telegram en boucle.
   */
  async notify({ request, response }: HttpContext) {
    if (!secretMatches(request.header('x-telegram-bot-api-secret-token'))) {
      logger.warn({ ip: request.ip() }, 'webhook Telegram sans secret valide')
      return response.forbidden({ error: { code: 'E_FORBIDDEN', message: 'Interdit.' } })
    }

    try {
      await handleUpdate(JSON.parse(request.raw() ?? 'null'))
    } catch (error) {
      logger.error({ err: error }, 'traitement d’une mise à jour Telegram impossible')
    }

    return response.noContent()
  }
}
