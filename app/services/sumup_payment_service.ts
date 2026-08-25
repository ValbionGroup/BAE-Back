import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import sumupConfig from '#config/sumup'
import ApiException from '#exceptions/api_exception'
import Payment from '#models/payment'
import SumUpClient from '#services/sumup/sumup_client'
import { priceCart, writeOrder, type CheckoutLine, type OrderDraft } from '#services/order_service'
import type { OrderPayload } from '#services/order_service'

const EXPIRE_SECONDS = 5 * 60

export interface OpenCardPaymentInput {
  eventId: number
  lines: readonly CheckoutLine[]
  memberId: number | null
  clientId: number | null
  sponsorshipCategoryId: number | null
}

export interface CardPaymentView {
  orderRef: string
  status: string
  amountCents: number
  eventId: number
  expiresAt: string | null
}

interface CardIntent {
  draft: OrderDraft
  memberId: number | null
  clientId: number | null
}

export function toCardPaymentView(payment: Payment): CardPaymentView {
  const intent = JSON.parse(payment.intent) as CardIntent

  return {
    orderRef: payment.orderRef,
    status: payment.status,
    amountCents: payment.amountCents,
    eventId: intent.draft.eventId,
    expiresAt: payment.expiresAt ? payment.expiresAt.toISO() : null,
  }
}

/** Tarifie le panier, puis lance le paiement sur le terminal. */
export async function openCardPayment(input: OpenCardPaymentInput): Promise<Payment> {
  const draft = await db.transaction(async (trx) =>
    priceCart(input.eventId, input.lines, input.sponsorshipCategoryId, trx)
  )

  const intent: CardIntent = {
    draft,
    memberId: input.memberId,
    clientId: input.clientId,
  }

  const payment = await Payment.create({
    provider: 'sumup',
    status: 'pending',
    orderRef: randomUUID(),
    amountCents: draft.totalCents,
    currency: 'EUR',
    userId: input.clientId,
    kind: 'order',
    intent: JSON.stringify(intent),
    expiresAt: DateTime.now().plus({ seconds: EXPIRE_SECONDS }),
  })

  const client = await app.container.make(SumUpClient)

  try {
    const created = await client.createCheckout({
      amountCents: draft.totalCents,
      description: 'BAE — commande au comptoir',
      returnUrl: `${sumupConfig.callbackBaseUrl}/v1/sumup/callback/${payment.orderRef}`,
    })

    payment.providerReference = created.clientTransactionId
    payment.providerRequestId = created.checkoutId
    await payment.save()
  } catch (error) {
    payment.status = 'cancelled'
    await payment.save()
    throw error
  }

  return payment
}

async function markTerminal(
  payment: Payment,
  status: 'refused' | 'cancelled'
): Promise<OrderPayload | null> {
  await db
    .from('payments')
    .where('id', payment.id)
    .where('status', 'pending')
    .update({ status, updated_at: DateTime.now().toSQL() })

  return null
}

/**
 * Relit l'issue chez SumUp et, si la carte a payé, écrit la commande.
 *
 * Le corps du webhook n'est **jamais** cru : il ne fait que réveiller cette
 * fonction, qui interroge SumUp elle-même. Même défiance que `confirmPayment`
 * pour Lydia.
 *
 * Rend la commande écrite — le contrôleur en a besoin pour la diffuser — ou
 * `null` quand rien n'a été écrit.
 */
export async function confirmCardPayment(orderRef: string): Promise<OrderPayload | null> {
  const payment = await Payment.findBy('orderRef', orderRef)
  if (!payment || payment.status !== 'pending' || !payment.providerReference) return null

  const client = await app.container.make(SumUpClient)
  const remote = await client.transactionState(payment.providerReference)

  if (remote.state === 'failed') return markTerminal(payment, 'refused')
  if (remote.state === 'cancelled') return markTerminal(payment, 'cancelled')

  if (remote.state === 'refunded') {
    logger.error({ orderRef }, 'transaction SumUp déjà remboursée : aucune commande écrite')
    return markTerminal(payment, 'refused')
  }

  if (remote.state !== 'successful') return null

  if (remote.amountCents !== null && remote.amountCents !== payment.amountCents) {
    logger.error(
      { orderRef, expected: payment.amountCents, received: remote.amountCents },
      'montant SumUp divergent'
    )
    return markTerminal(payment, 'refused')
  }

  return db.transaction(async (trx) => {
    const claimed = await trx
      .from('payments')
      .where('id', payment.id)
      .where('status', 'pending')
      .update({
        status: 'paid',
        paid_at: DateTime.now().toSQL(),
        transaction_identifier: remote.transactionCode,
        updated_at: DateTime.now().toSQL(),
      })

    if (Number(claimed) === 0) return null

    const intent = JSON.parse(payment.intent) as CardIntent
    const order = await writeOrder(intent.draft, intent.memberId, intent.clientId, 'card', trx)

    const row = await trx.from('orders').where('id', order.id).select('transaction_id').first()
    await trx
      .from('payments')
      .where('id', payment.id)
      .update({ transaction_id: row ? Number(row.transaction_id) : null })

    return order
  })
}

/** Interrompt le paiement sur le terminal. */
export async function cancelCardPayment(orderRef: string): Promise<Payment> {
  const payment = await Payment.findBy('orderRef', orderRef)
  if (!payment) {
    throw new ApiException('E_PAYMENT_NOT_FOUND', "Ce paiement n'existe pas.", 404)
  }

  if (payment.status !== 'pending') return payment

  const client = await app.container.make(SumUpClient)
  await client.terminateCheckout()

  await db
    .from('payments')
    .where('id', payment.id)
    .where('status', 'pending')
    .update({ status: 'cancelled', updated_at: DateTime.now().toSQL() })

  await payment.refresh()
  return payment
}
