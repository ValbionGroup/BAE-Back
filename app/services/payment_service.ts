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

  // Insertion directe : la clé primaire de `subscriptions` est composite, et
  // `Subscription.create()` tenterait de relire la ligne par un `id` absent.
  await trx.table('subscriptions').insert({
    user_id: payment.userId,
    fast_pass_id: Number(intent.fastPassId),
    subscribed_at: now.toSQL(),
    transaction_id: transaction.id,
    created_at: now.toSQL(),
    updated_at: now.toSQL(),
  })
}

/**
 * Traite une notification de paiement.
 *
 * ⚠️ **Le corps de la notification n'entre pas ici.** La vérité est ce que
 * `state.json` répond, ce qui rend la route inoffensive même appelée par un
 * tiers ayant deviné une référence — et contourne au passage le fait que
 * `case_converter_middleware` réécrit le corps reçu, rendant impossible toute
 * vérification de signature calculée sur les octets d'origine.
 *
 * Ne lève jamais pour une référence inconnue ou déjà traitée : Lydia rejouerait
 * indéfiniment.
 */
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
    // L'idempotence tient entière dans ce `where`, et dans le fait qu'il vit
    // **à l'intérieur** de la transaction : la ligne reste verrouillée jusqu'au
    // commit, donc deux notifications simultanées se sérialisent et la seconde
    // ne voit plus « pending ». Un `if (déjà traité) return` lu puis écrit
    // laisserait passer les deux ; le même `update` hors transaction laisserait
    // un paiement marqué payé sans contrepartie si la suite échouait.
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
    transaction.amount = (payment.amountCents / 100).toFixed(2)
    await transaction.save()

    const intent = JSON.parse(payment.intent) as Record<string, unknown>
    await fulfilSubscription(payment, intent, transaction, trx)

    await trx.from('payments').where('id', payment.id).update({ transaction_id: transaction.id })
  })
}
