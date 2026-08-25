import ApiException from '#exceptions/api_exception'
import SumUpClient, { type SumUpReader } from './sumup_client.js'
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  TransactionStateResult,
} from './sumup_payload.js'

/**
 * Le seul SumUp que connaissent les tests, et celui du développement local.
 *
 * Il rend le webhook superflu : `nextState` décide de l'issue, et les tests
 * appellent la confirmation directement. En local, un paiement CB aboutit donc
 * sans tunnel HTTPS ni terminal physique.
 */
export default class FakeSumUpClient extends SumUpClient {
  readonly checkouts: CreateCheckoutInput[] = []
  terminated = 0

  nextState: TransactionStateResult = {
    state: 'successful',
    amountCents: null,
    transactionCode: 'TX-FAKE',
  }
  failNextCheckout = false

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (this.failNextCheckout) {
      this.failNextCheckout = false
      throw new ApiException('E_SUMUP_CHECKOUT_FAILED', 'SumUp a refusé le paiement.', 502)
    }

    this.checkouts.push(input)

    return {
      checkoutId: `chk-${this.checkouts.length}`,
      clientTransactionId: `ctx-${this.checkouts.length}`,
    }
  }

  async terminateCheckout(): Promise<void> {
    this.terminated += 1
  }

  async transactionState(): Promise<TransactionStateResult> {
    return this.nextState
  }

  async listReaders(): Promise<SumUpReader[]> {
    return [
      { id: 'rdr_fake', name: 'Lecteur de test', status: 'paired', deviceIdentifier: 'SOLO-FAKE' },
    ]
  }

  async pairReader(_pairingCode: string, name: string): Promise<SumUpReader> {
    return { id: 'rdr_fake', name, status: 'paired', deviceIdentifier: 'SOLO-FAKE' }
  }
}
