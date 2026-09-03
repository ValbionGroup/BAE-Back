import ApiException from '#exceptions/api_exception'
import LydiaClient from './lydia_client.js'
import type {
  ChargeQrCodeInput,
  ChargeQrCodeResult,
  CreateRequestInput,
  CreateRequestResult,
  RequestStateResult,
} from './lydia_payload.js'

/**
 * Le seul Lydia que connaissent les tests, et celui du développement local.
 */
export default class FakeLydiaClient extends LydiaClient {
  readonly created: CreateRequestInput[] = []
  readonly charged: ChargeQrCodeInput[] = []

  nextState: RequestStateResult = { state: 1, amountCents: null, transactionIdentifier: 'tx-fake' }
  failNextCreate = false

  /** `'decline'` simule un refus Lydia, `'unreachable'` une panne de transport
   *  (cf. `HttpLydiaClient.post`). `null` (défaut) fait réussir en renvoyant
   *  l'`amountCents` reçu — la plupart des tests n'ont donc rien à régler. */
  nextCharge: ChargeQrCodeResult | 'decline' | 'unreachable' | null = null

  async createRequest(input: CreateRequestInput): Promise<CreateRequestResult> {
    if (this.failNextCreate) {
      this.failNextCreate = false
      throw new ApiException('E_LYDIA_REQUEST_FAILED', 'Lydia a refusé la demande.', 502)
    }

    this.created.push(input)

    return {
      requestUuid: `uuid-${this.created.length}-${input.orderRef}`,
      requestId: String(this.created.length),
      mobileUrl: `https://lydia.test/pay/${input.orderRef}`,
    }
  }

  async requestState(): Promise<RequestStateResult> {
    return this.nextState
  }

  async chargeQrCode(input: ChargeQrCodeInput): Promise<ChargeQrCodeResult> {
    this.charged.push(input)

    if (this.nextCharge === 'decline') {
      throw new ApiException('E_LYDIA_PAYMENT_REFUSED', 'Le client a refusé le paiement.', 502)
    }

    if (this.nextCharge === 'unreachable') {
      throw new ApiException('E_LYDIA_UNREACHABLE', 'Lydia est injoignable.', 502)
    }

    return this.nextCharge ?? { transactionIdentifier: 'tx-fake', amountCents: input.amountCents }
  }
}
