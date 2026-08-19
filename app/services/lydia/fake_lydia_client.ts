import ApiException from '#exceptions/api_exception'
import LydiaClient from './lydia_client.js'
import type {
  CreateRequestInput,
  CreateRequestResult,
  RequestStateResult,
} from './lydia_payload.js'

/**
 * Le seul Lydia que connaissent les tests, et celui du développement local.
 *
 * Il existe parce que le BAE ne dispose que de jetons de production : les
 * défauts à couvrir — notification rejouée, montant divergent, demande
 * abandonnée — ne peuvent pas être déclenchés à la main sans déplacer de
 * l'argent réel.
 */
export default class FakeLydiaClient extends LydiaClient {
  /** Les demandes reçues, dans l'ordre — ce que les tests inspectent. */
  readonly created: CreateRequestInput[] = []

  /** L'état que rendra la prochaine interrogation. Confirmé par défaut. */
  nextState: RequestStateResult = { state: 1, amountCents: null, transactionIdentifier: 'tx-fake' }

  /** Consommé au premier appel : joue un refus de Lydia, puis se désarme. */
  failNextCreate = false

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
}
