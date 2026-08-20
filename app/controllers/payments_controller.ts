import type { HttpContext } from '@adonisjs/core/http'
import Payment from '#models/payment'

/**
 * Vue **staff** d'un paiement, distincte de celle du client
 * (`toPaymentView`) : elle expose les identifiants du prestataire, qui sont
 * précisément ce qu'un rapprochement compare au relevé Lydia, et que la vue
 * client n'a aucune raison de porter.
 */
interface PaymentRow {
  id: number
  orderRef: string
  status: string
  kind: string
  provider: string
  /** En **centimes**. Le front convertit. */
  amountCents: number
  providerReference: string | null
  transactionIdentifier: string | null
  /** `null` tant que le paiement n'est pas confirmé. */
  transactionId: number | null
  paidAt: string | null
  expiresAt: string | null
  createdAt: string | null
  payerName: string | null
  payerEmail: string | null
}

export default class PaymentsController {
  async index({ serialize }: HttpContext) {
    const payments = await Payment.query().preload('user').orderBy('createdAt', 'desc')

    const rows: PaymentRow[] = payments.map((payment) => ({
      id: payment.id,
      orderRef: payment.orderRef,
      status: payment.status,
      kind: payment.kind,
      provider: payment.provider,
      amountCents: payment.amountCents,
      providerReference: payment.providerReference,
      transactionIdentifier: payment.transactionIdentifier,
      transactionId: payment.transactionId ?? null,
      paidAt: payment.paidAt ? payment.paidAt.toISO() : null,
      expiresAt: payment.expiresAt ? payment.expiresAt.toISO() : null,
      createdAt: payment.createdAt ? payment.createdAt.toISO() : null,
      payerName: payment.user?.fullName ?? null,
      payerEmail: payment.user?.email ?? null,
    }))

    return serialize(rows)
  }
}
