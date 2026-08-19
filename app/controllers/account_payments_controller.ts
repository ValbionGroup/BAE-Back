import type { HttpContext } from '@adonisjs/core/http'
import ApiException from '#exceptions/api_exception'
import FastPass from '#models/fast_pass'
import { createAccountSubscriptionValidator } from '#validators/account_purchase'
import { openPayment, toPaymentView } from '#services/payment_service'

/**
 * Un quart d'heure : assez pour payer sur son téléphone, assez court pour que
 * la file des demandes en attente reste lisible.
 */
const PAYMENT_WINDOW_SECONDS = 900

export default class AccountPaymentsController {
  async subscribe({ auth, request, serialize }: HttpContext) {
    const { fastPassId } = await request.validateUsing(createAccountSubscriptionValidator)
    const user = auth.getUserOrFail()

    const fastPass = await FastPass.find(fastPassId)
    if (!fastPass) {
      throw new ApiException('E_FAST_PASS_NOT_FOUND', 'Formule introuvable.', 404)
    }

    // `fast_passes.price` est un décimal en euros quand tout le reste de l'API
    // publique compte en centimes — `public_catalog_service` convertit pareil.
    const amountCents = Math.round(Number(fastPass.price) * 100)

    const payment = await openPayment({
      user,
      kind: 'subscription',
      amountCents,
      message: `Cotisation BAE — ${fastPass.label}`,
      intent: { fastPassId: fastPass.id },
      expireTimeSeconds: PAYMENT_WINDOW_SECONDS,
    })

    return serialize(toPaymentView(payment))
  }
}
