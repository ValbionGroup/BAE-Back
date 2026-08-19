import type { HttpContext } from '@adonisjs/core/http'
import ApiException from '#exceptions/api_exception'
import FastPass from '#models/fast_pass'
import {
  createAccountPreOrderValidator,
  createAccountSubscriptionValidator,
} from '#validators/account_purchase'
import { openPayment, toPaymentView } from '#services/payment_service'
import { quotePreOrder } from '#services/pre_order_quote_service'

/**
 * Un quart d'heure : assez pour payer sur son téléphone, assez court pour que
 * la file des demandes en attente reste lisible.
 */
const PAYMENT_WINDOW_SECONDS = 900

/**
 * Marge entre l'expiration d'une demande et la clôture des précommandes : le
 * temps que la notification de Lydia nous parvienne et soit traitée.
 */
const CLOSE_MARGIN_SECONDS = 60

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

  async preOrder({ auth, request, serialize }: HttpContext) {
    const payload = await request.validateUsing(createAccountPreOrderValidator)
    const user = auth.getUserOrFail()

    const quote = await quotePreOrder(user.id, payload.eventId, payload.lines)

    // ⚠️ La demande ne doit **jamais** survivre à la clôture : confirmée après,
    // elle encaisserait une précommande que la cuisine ne peut plus produire.
    // C'est le seul garde-fou contre « payé mais rien à livrer », la
    // précommande n'étant créée qu'à la confirmation.
    const expireTimeSeconds = Math.max(
      CLOSE_MARGIN_SECONDS,
      Math.min(PAYMENT_WINDOW_SECONDS, quote.secondsUntilClose - CLOSE_MARGIN_SECONDS)
    )

    const payment = await openPayment({
      user,
      kind: 'pre_order',
      amountCents: quote.amountCents,
      message: 'Précommande BAE',
      intent: {
        eventId: payload.eventId,
        pickupAt: payload.pickupAt ? payload.pickupAt.toISO() : null,
        lines: payload.lines,
      },
      expireTimeSeconds,
    })

    return serialize(toPaymentView(payment))
  }
}
