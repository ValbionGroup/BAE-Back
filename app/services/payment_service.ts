import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import lydiaConfig from '#config/lydia'
import Payment from '#models/payment'
import type User from '#models/user'
import LydiaClient from '#services/lydia/lydia_client'

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

/**
 * Ouvre une demande de paiement et en garde la trace **avant** d'appeler Lydia.
 *
 * L'ordre compte : une ligne écrite d'abord survit à un appel qui échoue à
 * mi-chemin, alors qu'un appel réussi suivi d'une écriture perdue laisserait
 * une demande facturable que rien ici ne connaîtrait.
 */
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
      // L'adresse vient du SSO. Lydia s'en sert pour reconnaître un compte
      // existant et proposer le paiement en un clic ; à défaut, le client tombe
      // sur le formulaire carte. Ce n'est pas une sollicitation envoyée.
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
    // Annulé plutôt que supprimé : garder la trace des demandes qui n'aboutissent
    // pas est précisément ce qu'une table dédiée permet.
    payment.status = 'cancelled'
    await payment.save()
    throw error
  }

  return payment
}
