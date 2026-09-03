import ApiException from '#exceptions/api_exception'

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

  const amount = body.amount
  const parsed = amount === undefined || amount === null ? null : Math.round(Number(amount) * 100)

  const identifier = body.transaction_identifier ?? body.transaction

  return {
    state,
    amountCents: parsed !== null && Number.isFinite(parsed) ? parsed : null,
    transactionIdentifier: typeof identifier === 'string' ? identifier : null,
  }
}

export interface ChargeQrCodeInput {
  phone: string
  paymentData: string
  amountCents: number
  orderId: string
}

export interface ChargeQrCodeResult {
  transactionIdentifier: string
  amountCents: number
}

/**
 * `paymentData` est le seul champ de cet endpoint Lydia en camelCase — le
 * reste de l'API est en snake_case. Ne pas « corriger » : c'est le nom exact
 * de la doc officielle.
 */
export function buildChargeQrCodeBody(
  input: ChargeQrCodeInput,
  vendorToken: string
): URLSearchParams {
  return new URLSearchParams({
    vendor_token: vendorToken,
    phone: input.phone,
    paymentData: input.paymentData,
    amount: euros(input.amountCents),
    currency: 'EUR',
    order_id: input.orderId,
    transmission: 'qrcode',
  })
}

export function parseChargeQrCodeResponse(payload: unknown): ChargeQrCodeResult {
  const body = asRecord(payload)

  if (Number(body.error ?? -1) !== 0) {
    throw new ApiException(
      'E_LYDIA_PAYMENT_REFUSED',
      `Lydia a refusé le paiement : ${String(body.message ?? 'raison inconnue')}`,
      502
    )
  }

  const identifier = body.transaction_identifier
  const amount = body.amount

  if (typeof identifier !== 'string' || amount === undefined || amount === null) {
    throw new ApiException(
      'E_LYDIA_PAYMENT_REFUSED',
      'Réponse de Lydia inexploitable : identifiant de transaction ou montant absent.',
      502
    )
  }

  return {
    transactionIdentifier: identifier,
    amountCents: Math.round(Number(amount) * 100),
  }
}
