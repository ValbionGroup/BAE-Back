import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { confirmPayment } from '#services/payment_service'

export default class LydiaCallbacksController {
  /**
   * @warning Répond 204 quoi qu'il arrive, y compris sur une référence inconnue ou une
   * panne.
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
