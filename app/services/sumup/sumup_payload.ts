import ApiException from '#exceptions/api_exception'

export type SumUpState = 'pending' | 'successful' | 'failed' | 'cancelled' | 'refunded'

export interface CreateCheckoutInput {
  amountCents: number
  description: string
  returnUrl: string
}

export interface CreateCheckoutResult {
  checkoutId: string
  clientTransactionId: string
}

export interface TransactionStateResult {
  state: SumUpState
  amountCents: number | null
  transactionCode: string | null
}

interface CheckoutBody {
  total_amount: { currency: string; minor_unit: number; value: number }
  description: string
  return_url: string
}

export function buildCheckoutBody(input: CreateCheckoutInput): CheckoutBody {
  return {
    total_amount: { currency: 'EUR', minor_unit: 2, value: input.amountCents },
    description: input.description,
    return_url: input.returnUrl,
  }
}

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
}

export function parseCheckoutResponse(payload: unknown): CreateCheckoutResult {
  const body = asRecord(asRecord(payload).data ?? payload)

  const checkoutId = body.checkout_id
  const clientTransactionId = body.client_transaction_id

  if (typeof clientTransactionId !== 'string' || clientTransactionId.length === 0) {
    throw new ApiException(
      'E_SUMUP_CHECKOUT_FAILED',
      "Réponse de SumUp inexploitable : le paiement ne pourrait plus être suivi jusqu'à son issue.",
      502
    )
  }

  return {
    checkoutId: typeof checkoutId === 'string' ? checkoutId : '',
    clientTransactionId,
  }
}

const STATES: Record<string, SumUpState> = {
  SUCCESSFUL: 'successful',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PENDING: 'pending',
  REFUNDED: 'refunded',
}

/**
 * ⚠️ `amount` revient en **euros** (`15.0` = 15 €), là où le checkout est parti
 * en centimes. Un statut inconnu retombe sur `pending` : inventer un succès
 * écrirait une commande sans qu'aucun argent ne soit arrivé.
 */
export function parseTransactionResponse(payload: unknown): TransactionStateResult {
  const body = asRecord(asRecord(payload).data ?? payload)

  const state = STATES[String(body.status ?? '')] ?? 'pending'

  const amount = body.amount
  const cents = amount === undefined || amount === null ? null : Math.round(Number(amount) * 100)
  const code = body.transaction_code

  return {
    state,
    amountCents: cents !== null && Number.isFinite(cents) ? cents : null,
    transactionCode: typeof code === 'string' ? code : null,
  }
}
