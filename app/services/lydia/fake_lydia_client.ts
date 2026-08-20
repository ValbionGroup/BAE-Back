import ApiException from '#exceptions/api_exception'
import LydiaClient from './lydia_client.js'
import type {
  CreateRequestInput,
  CreateRequestResult,
  RequestStateResult,
} from './lydia_payload.js'

/**
 * Le seul Lydia que connaissent les tests, et celui du développement local.
 */
export default class FakeLydiaClient extends LydiaClient {
  readonly created: CreateRequestInput[] = []

  nextState: RequestStateResult = { state: 1, amountCents: null, transactionIdentifier: 'tx-fake' }
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
