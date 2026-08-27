import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'
import {
  cancelCardPayment,
  confirmCardPayment,
  openCardPayment,
  toCardPaymentView,
} from '#services/sumup_payment_service'
import { cardPaymentOpenValidator } from '#validators/card_payment'
import { assertMayDiscount } from '#services/order_service'
import { broadcastCardPayment, broadcastOrder } from '#services/orders_realtime'
import Payment from '#models/payment'
import ApiException from '#exceptions/api_exception'

export default class CardPaymentsController {
  /** Ouvre un paiement par carte et allume le terminal. */
  async store({ params, request, response, serialize, auth }: HttpContext) {
    const payload = await request.validateUsing(cardPaymentOpenValidator)

    const cashier = auth.user ? await Member.find(auth.user.id) : null
    const discount = payload.discount ?? null

    // Avant d'allumer le terminal : refuser après aurait déjà engagé le client.
    await assertMayDiscount(cashier?.id ?? null, discount)

    const payment = await openCardPayment({
      eventId: Number(params.id),
      lines: payload.lines,
      memberId: cashier?.id ?? null,
      clientId: payload.clientId ?? null,
      sponsorshipCategoryId: payload.sponsorshipCategoryId ?? null,
      discount,
    })

    response.status(201)
    return serialize(toCardPaymentView(payment))
  }

  /** L'état courant, tel que la caisse l'affiche. */
  async show({ params, serialize }: HttpContext) {
    const payment = await Payment.findBy('orderRef', String(params.orderRef))
    if (!payment) {
      throw new ApiException('E_PAYMENT_NOT_FOUND', "Ce paiement n'existe pas.", 404)
    }

    return serialize(toCardPaymentView(payment))
  }

  /** La relecture manuelle, derrière le bouton « Vérifier l'état » de la caisse. */
  async refresh({ params, serialize }: HttpContext) {
    const orderRef = String(params.orderRef)
    const order = await confirmCardPayment(orderRef)

    const payment = await Payment.findBy('orderRef', orderRef)
    if (!payment) {
      throw new ApiException('E_PAYMENT_NOT_FOUND', "Ce paiement n'existe pas.", 404)
    }

    const view = toCardPaymentView(payment)
    broadcastCardPayment(view.eventId, view.orderRef, view.status, order)
    if (order) broadcastOrder('order.created', order)

    return serialize(view)
  }

  /** Interrompt le paiement sur le terminal et referme la demande. */
  async destroy({ params, serialize }: HttpContext) {
    const payment = await cancelCardPayment(String(params.orderRef))

    return serialize(toCardPaymentView(payment))
  }
}
