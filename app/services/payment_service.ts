import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import lydiaConfig from '#config/lydia'
import Payment from '#models/payment'
import Transaction from '#models/transaction'
import type User from '#models/user'
import LydiaClient from '#services/lydia/lydia_client'
import type { PricedQuoteLine } from '#services/pre_order_quote_service'

export type PaymentKind = 'pre_order' | 'subscription'

export interface OpenPaymentInput {
  user: User
  kind: PaymentKind
  amountCents: number
  message: string
  intent: Record<string, unknown>
  expireTimeSeconds: number
}

export interface PaymentView {
  orderRef: string
  status: string
  amountCents: number
  mobileUrl: string | null
  expiresAt: string | null
}

export function toPaymentView(payment: Payment): PaymentView {
  return {
    orderRef: payment.orderRef,
    status: payment.status,
    amountCents: payment.amountCents,
    mobileUrl: payment.mobileUrl,
    expiresAt: payment.expiresAt ? payment.expiresAt.toISO() : null,
  }
}

export async function openPayment(input: OpenPaymentInput): Promise<Payment> {
  const payment = await Payment.create({
    provider: 'lydia',
    status: 'pending',
    orderRef: randomUUID(),
    amountCents: input.amountCents,
    currency: 'EUR',
    userId: input.user.id,
    kind: input.kind,
    intent: JSON.stringify(input.intent),
    expiresAt: DateTime.now().plus({ seconds: input.expireTimeSeconds }),
  })

  const returnUrl = `${lydiaConfig.publicAppUrl}/paiement/${payment.orderRef}`
  const client = await app.container.make(LydiaClient)

  try {
    const created = await client.createRequest({
      recipient: input.user.email,
      amountCents: input.amountCents,
      orderRef: payment.orderRef,
      message: input.message,
      expireTimeSeconds: input.expireTimeSeconds,
      confirmUrl: `${lydiaConfig.callbackBaseUrl}/v1/lydia/callback/${payment.orderRef}`,
      browserSuccessUrl: returnUrl,
      browserFailUrl: returnUrl,
    })

    payment.providerReference = created.requestUuid
    payment.providerRequestId = created.requestId
    payment.mobileUrl = created.mobileUrl
    await payment.save()
  } catch (error) {
    payment.status = 'cancelled'
    await payment.save()
    throw error
  }

  return payment
}

async function markTerminal(payment: Payment, status: 'refused' | 'cancelled'): Promise<void> {
  await db
    .from('payments')
    .where('id', payment.id)
    .where('status', 'pending')
    .update({ status, updated_at: DateTime.now().toSQL() })
}

async function fulfilSubscription(
  payment: Payment,
  intent: Record<string, unknown>,
  transaction: Transaction,
  trx: TransactionClientContract
): Promise<void> {
  const now = DateTime.now()

  await trx.table('subscriptions').insert({
    user_id: payment.userId,
    fast_pass_id: Number(intent.fastPassId),
    subscribed_at: now.toSQL(),
    transaction_id: transaction.id,
    created_at: now.toSQL(),
    updated_at: now.toSQL(),
  })
}

async function menuPricesOf(
  eventId: number,
  trx: TransactionClientContract
): Promise<Map<number, number>> {
  const rows = await trx
    .from('event_products')
    .where('event_id', eventId)
    .select('product_id', 'price')

  return new Map(rows.map((row) => [Number(row.product_id), Number(row.price)]))
}

async function fulfilPreOrder(
  payment: Payment,
  intent: Record<string, unknown>,
  transaction: Transaction,
  trx: TransactionClientContract
): Promise<void> {
  const now = DateTime.now()
  const eventId = Number(intent.eventId)
  const lines = intent.lines as PricedQuoteLine[]

  // `payments.user_id` est nullable, `pre_orders.user_id` ne l'est pas. Sans ce
  // garde, l'insert plus bas lèverait une erreur de base : la transaction
  // repartirait en arrière, le paiement redeviendrait `pending` et le webhook
  // serait rejoué sans fin.
  const userId = payment.userId
  if (userId === null) {
    logger.error({ paymentId: payment.id }, 'Paiement de précommande sans compte : rien à créer.')
    return
  }

  const stale = lines.some((line) => typeof line.listPriceCents !== 'number')
  const menu = stale ? await menuPricesOf(eventId, trx) : new Map<number, number>()

  // Sérialise les encaissements d'une même soirée. Deux paiements ouverts avant
  // que l'un des deux soit confirmé ne se voient pas au devis : sans ce verrou
  // ils créent deux précommandes, et l'index partiel les refuserait *après*
  // débit — c'est-à-dire au pire moment.
  await trx.from('events').where('id', eventId).forUpdate().select('id')

  const existing = await trx
    .from('pre_orders')
    .where('user_id', userId)
    .where('event_id', eventId)
    .whereNot('status', 'cancelled')
    .first()

  // Le paiement reste `paid` : lever ici annulerait la transaction, le paiement
  // repasserait `pending` et le webhook Lydia serait rejoué en boucle. Le
  // second débit est signalé pour être remboursé à la main — il n'existe pas
  // encore de statut de remboursement.
  if (existing) {
    logger.error(
      { userId, eventId, paymentId: payment.id, preOrderId: existing.id },
      'Second paiement encaissé pour une précommande déjà existante — remboursement à faire.'
    )
    return
  }

  // `capacity` est une estimation, pas un quota : un dépassement se signale,
  // il ne refuse pas un client qui a déjà payé.
  const [{ count: placed }] = await trx
    .from('pre_orders')
    .where('event_id', eventId)
    .whereNot('status', 'cancelled')
    .count('* as count')

  const capacity = await trx.from('events').where('id', eventId).select('capacity').first()

  if (capacity && Number(placed) >= Number(capacity.capacity)) {
    logger.warn(
      { eventId, capacity: Number(capacity.capacity), placed: Number(placed) },
      'Précommande encaissée au-delà de la capacité annoncée.'
    )
  }

  const [row] = await trx
    .table('pre_orders')
    .insert({
      user_id: userId,
      event_id: eventId,
      transaction_id: transaction.id,
      status: 'pending',
      discount_percent: typeof intent.discountPercent === 'number' ? intent.discountPercent : 0,
      pickup_at: typeof intent.pickupAt === 'string' ? intent.pickupAt : null,
      created_at: now.toSQL(),
    })
    .returning('id')

  const preOrderId = typeof row === 'object' ? Number(row.id) : Number(row)

  await trx.table('pre_order_items').insert(
    lines.map((line) => ({
      pre_order_id: preOrderId,
      product_id: line.productId,
      quantity: line.quantity,
      received_quantity: 0,
      list_price_cents:
        typeof line.listPriceCents === 'number'
          ? line.listPriceCents
          : (menu.get(line.productId) ?? 0),
      created_at: now.toSQL(),
      updated_at: now.toSQL(),
    }))
  )
}

export async function confirmPayment(orderRef: string): Promise<void> {
  const payment = await Payment.findBy('orderRef', orderRef)
  if (!payment || payment.status !== 'pending' || !payment.providerReference) return

  const client = await app.container.make(LydiaClient)
  const remote = await client.requestState(payment.providerReference)

  if (remote.state === 5) return markTerminal(payment, 'refused')
  if (remote.state === 6) return markTerminal(payment, 'cancelled')
  if (remote.state !== 1) return

  if (remote.amountCents !== null && remote.amountCents !== payment.amountCents) {
    logger.error(
      { orderRef, expected: payment.amountCents, received: remote.amountCents },
      'montant Lydia divergent'
    )
    return markTerminal(payment, 'refused')
  }

  await db.transaction(async (trx) => {
    const claimed = await trx
      .from('payments')
      .where('id', payment.id)
      .where('status', 'pending')
      .update({
        status: 'paid',
        paid_at: DateTime.now().toSQL(),
        transaction_identifier: remote.transactionIdentifier,
        updated_at: DateTime.now().toSQL(),
      })

    if (Number(claimed) === 0) return

    const transaction = new Transaction()
    transaction.useTransaction(trx)
    transaction.type = 'lydia'
    transaction.amount = payment.amountCents
    await transaction.save()

    const intent = JSON.parse(payment.intent) as Record<string, unknown>
    await (payment.kind === 'subscription'
      ? fulfilSubscription(payment, intent, transaction, trx)
      : fulfilPreOrder(payment, intent, transaction, trx))

    await trx.from('payments').where('id', payment.id).update({ transaction_id: transaction.id })
  })
}
