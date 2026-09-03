import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import ApiException from '#exceptions/api_exception'
import Member from '#models/member'
import Payment from '#models/payment'
import LydiaClient from '#services/lydia/lydia_client'
import type { DiscountInput } from '#services/order_service'
import { priceCart, writeOrder, type CheckoutLine } from '#services/order_service'
import type { OrderPayload } from '#services/order_service'

export interface PayWithLydiaQrCodeInput {
  eventId: number
  lines: readonly CheckoutLine[]
  memberId: number | null
  clientId: number | null
  sponsorshipCategoryId: number | null
  discount?: DiscountInput | null
  paymentData: string
}

async function markRefused(payment: Payment): Promise<void> {
  await db
    .from('payments')
    .where('id', payment.id)
    .where('status', 'pending')
    .update({ status: 'refused', updated_at: DateTime.now().toSQL() })
}

/**
 * Encaisse par QR Lydia (`POST /api/payment/payment`), synchrone en un seul
 * aller-retour — contrairement à SumUp, qui est en deux temps (`openCardPayment`
 * puis `confirmCardPayment`). Rien n'est écrit tant que Lydia n'a pas confirmé.
 */
export async function payWithLydiaQrCode(input: PayWithLydiaQrCodeInput): Promise<OrderPayload> {
  const cashier = input.memberId === null ? null : await Member.find(input.memberId)
  if (cashier === null || cashier.phone === null) {
    throw new ApiException(
      'E_LYDIA_PHONE_MISSING',
      'Renseignez votre téléphone dans Équipe avant d’encaisser par Lydia.',
      422
    )
  }

  const draft = await db.transaction((trx) =>
    priceCart(input.eventId, input.lines, input.sponsorshipCategoryId, input.discount ?? null, trx)
  )

  const payment = await Payment.create({
    provider: 'lydia',
    status: 'pending',
    orderRef: randomUUID(),
    amountCents: draft.totalCents,
    currency: 'EUR',
    userId: input.clientId,
    kind: 'order',
    intent: JSON.stringify({ draft, memberId: input.memberId, clientId: input.clientId }),
  })

  const client = await app.container.make(LydiaClient)

  let charged: { transactionIdentifier: string; amountCents: number }
  try {
    charged = await client.chargeQrCode({
      phone: cashier.phone,
      paymentData: input.paymentData,
      amountCents: draft.totalCents,
      orderId: payment.orderRef,
    })
  } catch (error) {
    await markRefused(payment)
    throw error
  }

  if (charged.amountCents !== draft.totalCents) {
    await markRefused(payment)
    throw new ApiException(
      'E_LYDIA_AMOUNT_MISMATCH',
      'Le montant confirmé par Lydia ne correspond pas au total attendu.',
      502
    )
  }

  return db.transaction(async (trx) => {
    const claimed = await trx
      .from('payments')
      .where('id', payment.id)
      .where('status', 'pending')
      .update({
        status: 'paid',
        paid_at: DateTime.now().toSQL(),
        transaction_identifier: charged.transactionIdentifier,
        updated_at: DateTime.now().toSQL(),
      })

    if (Number(claimed) === 0) {
      throw new ApiException('E_LYDIA_PAYMENT_REFUSED', 'Ce paiement a déjà été traité.', 409)
    }

    const order = await writeOrder(draft, input.memberId, input.clientId, 'lydia', trx)

    const row = await trx.from('orders').where('id', order.id).select('transaction_id').first()
    await trx
      .from('payments')
      .where('id', payment.id)
      .update({ transaction_id: row ? Number(row.transaction_id) : null })

    return order
  })
}
