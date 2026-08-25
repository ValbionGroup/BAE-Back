import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import Payment from '#models/payment'
import { confirmCardPayment, toCardPaymentView } from '#services/sumup_payment_service'
import { broadcastCardPayment, broadcastOrder } from '#services/orders_realtime'

export default class SumupCallbacksController {
  /**
   * Le webhook de SumUp.
   *
   * @warning Répond 204 quoi qu'il arrive, y compris sur une référence inconnue
   * ou une panne : un webhook qui échoue serait réémis en boucle.
   *
   * Le corps reçu n'est pas lu — il ne sert qu'à réveiller la relecture, qui
   * interroge SumUp elle-même.
   */
  async notify({ params, response }: HttpContext) {
    const orderRef = String(params.orderRef)

    try {
      const order = await confirmCardPayment(orderRef)
      const payment = await Payment.findBy('orderRef', orderRef)

      if (payment) {
        const view = toCardPaymentView(payment)
        broadcastCardPayment(view.eventId, view.orderRef, view.status, order)
      }
      if (order) broadcastOrder('order.created', order)
    } catch (error) {
      logger.error({ err: error, orderRef }, 'confirmation SumUp impossible')
    }

    return response.noContent()
  }
}
