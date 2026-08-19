import ApiException from '#exceptions/api_exception'

/**
 * La frontière avec Lydia, et rien d'autre : construire ce qui part, lire ce qui
 * revient. Aucun appel réseau ici, ce qui rend le contrat testable sans simuler
 * de serveur.
 *
 * ⚠️ Les noms de champs sont ceux de Lydia. Ils ne suivent pas les conventions
 * du dépôt et ne doivent jamais être dérivés d'un convertisseur de casse.
 */

/** Les états rendus par `state.json`. `-1` couvre tout ce qu'on ne sait pas lire. */
export type LydiaState = -1 | 0 | 1 | 5 | 6

export interface CreateRequestInput {
  recipient: string
  amountCents: number
  orderRef: string
  message: string
  expireTimeSeconds: number
  confirmUrl: string
  browserSuccessUrl: string
  browserFailUrl: string
}

export interface CreateRequestResult {
  requestUuid: string
  requestId: string
  mobileUrl: string
}

export interface RequestStateResult {
  state: LydiaState
  /** `null` quand Lydia ne renvoie pas de montant — ce champ n'est pas documenté. */
  amountCents: number | null
  transactionIdentifier: string | null
}

function euros(amountCents: number): string {
  return (amountCents / 100).toFixed(2)
}

export function buildDoBody(input: CreateRequestInput, vendorToken: string): URLSearchParams {
  return new URLSearchParams({
    vendor_token: vendorToken,
    recipient: input.recipient,
    type: 'email',
    amount: euros(input.amountCents),
    currency: 'EUR',
    order_ref: input.orderRef,
    message: input.message,
    payment_method: 'auto',
    // La page de confirmation de Lydia ajouterait un écran après le paiement ;
    // `browser_success_url` ramène directement le navigateur chez nous.
    display_confirmation: 'no',
    notify: 'no',
    notify_collector: 'no',
    expire_time: String(input.expireTimeSeconds),
    confirm_url: input.confirmUrl,
    cancel_url: input.confirmUrl,
    end_mobile_url: input.browserSuccessUrl,
    browser_success_url: input.browserSuccessUrl,
    browser_fail_url: input.browserFailUrl,
  })
}

export function buildStateBody(requestUuid: string, vendorToken: string): URLSearchParams {
  return new URLSearchParams({ vendor_token: vendorToken, request_uuid: requestUuid })
}

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
}

export function parseDoResponse(payload: unknown): CreateRequestResult {
  const body = asRecord(payload)

  // Lydia répond 200 même pour un refus : c'est `error` qui porte le verdict.
  if (Number(body.error ?? -1) !== 0) {
    throw new ApiException(
      'E_LYDIA_REQUEST_FAILED',
      `Lydia a refusé la demande de paiement : ${String(body.message ?? 'raison inconnue')}`,
      502
    )
  }

  const requestUuid = body.request_uuid
  const mobileUrl = body.mobile_url

  if (typeof requestUuid !== 'string' || typeof mobileUrl !== 'string') {
    throw new ApiException(
      'E_LYDIA_REQUEST_FAILED',
      'Réponse de Lydia inexploitable : identifiant ou URL de paiement absent.',
      502
    )
  }

  return { requestUuid, requestId: String(body.request_id ?? ''), mobileUrl }
}

export function parseStateResponse(payload: unknown): RequestStateResult {
  const body = asRecord(payload)
  const raw = Number(body.state)
  const state: LydiaState = [0, 1, 5, 6].includes(raw) ? (raw as LydiaState) : -1

  // Absent, le montant vaut « inconnu » : le lire comme 0 ferait échouer la
  // comparaison avec le montant attendu sur toute réponse qui n'en porte pas.
  const amount = body.amount
  const parsed = amount === undefined || amount === null ? null : Math.round(Number(amount) * 100)

  const identifier = body.transaction_identifier ?? body.transaction

  return {
    state,
    amountCents: parsed !== null && Number.isFinite(parsed) ? parsed : null,
    transactionIdentifier: typeof identifier === 'string' ? identifier : null,
  }
}
