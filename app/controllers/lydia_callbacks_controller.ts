import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { confirmPayment } from '#services/payment_service'

export default class LydiaCallbacksController {
  /**
   * ⚠️ Répond 204 quoi qu'il arrive, y compris sur une référence inconnue ou une
   * panne. Une erreur remontée ferait rejouer Lydia en boucle sur une
   * notification qui n'aboutira pas davantage au dixième essai.
   *
   * La référence vient du **chemin**, jamais du corps : c'est ce qui permet
   * d'ignorer entièrement ce que Lydia envoie.
   */
  async notify({ params, response }: HttpContext) {
    try {
      await confirmPayment(String(params.orderRef))
    } catch (error) {
      logger.error({ err: error, orderRef: params.orderRef }, 'confirmation Lydia impossible')
    }

    return response.noContent()
  }
}
