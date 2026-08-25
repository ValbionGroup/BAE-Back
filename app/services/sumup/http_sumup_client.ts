import logger from '@adonisjs/core/services/logger'
import ApiException from '#exceptions/api_exception'
import { describeFetchFailure } from '#services/lydia/http_lydia_client'
import SumUpClient, { type SumUpReader } from './sumup_client.js'
import {
  buildCheckoutBody,
  parseCheckoutResponse,
  parseTransactionResponse,
  type CreateCheckoutInput,
  type CreateCheckoutResult,
  type TransactionStateResult,
} from './sumup_payload.js'

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
}

export function toReader(payload: unknown): SumUpReader {
  const row = asRecord(payload)
  const device = asRecord(row.device)

  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    status: String(row.status ?? 'unknown'),
    deviceIdentifier: typeof device.identifier === 'string' ? device.identifier : null,
  }
}

export default class HttpSumUpClient extends SumUpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly merchantCode: string,
    private readonly readerId: string
  ) {
    super()
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    return parseCheckoutResponse(
      await this.send(
        'POST',
        `/v0.1/merchants/${this.merchantCode}/readers/${this.readerId}/checkout`,
        buildCheckoutBody(input)
      )
    )
  }

  async terminateCheckout(): Promise<void> {
    await this.send(
      'POST',
      `/v0.1/merchants/${this.merchantCode}/readers/${this.readerId}/terminate`
    )
  }

  /**
   * ⚠️ Version d'API différente du reste (`v2.1`) : les transactions ne vivent
   * pas sous le même préfixe que les lecteurs.
   */
  async transactionState(clientTransactionId: string): Promise<TransactionStateResult> {
    const query = new URLSearchParams({ client_transaction_id: clientTransactionId })

    return parseTransactionResponse(
      await this.send('GET', `/v2.1/merchants/${this.merchantCode}/transactions?${query}`)
    )
  }

  async listReaders(): Promise<SumUpReader[]> {
    const payload = await this.send('GET', `/v0.1/merchants/${this.merchantCode}/readers`)
    const items = asRecord(payload).items ?? payload

    return Array.isArray(items) ? items.map(toReader) : []
  }

  async pairReader(pairingCode: string, name: string): Promise<SumUpReader> {
    return toReader(
      await this.send('POST', `/v0.1/merchants/${this.merchantCode}/readers`, {
        pairing_code: pairingCode,
        name,
      })
    )
  }

  private async send(method: string, path: string, body?: unknown): Promise<unknown> {
    let response: Response

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      logger.error(
        { err: error, url: `${this.baseUrl}${path}` },
        `SumUp injoignable : ${describeFetchFailure(error)}`
      )
      throw new ApiException('E_SUMUP_UNREACHABLE', 'SumUp est injoignable.', 502)
    }

    if (response.status === 409) {
      throw new ApiException(
        'E_SUMUP_READER_BUSY',
        'Le lecteur traite déjà un paiement : terminez-le ou annulez-le avant d’en lancer un autre.',
        409
      )
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      logger.error({ status: response.status, detail, path }, 'SumUp a refusé la requête')

      throw new ApiException('E_SUMUP_UNREACHABLE', `SumUp a répondu ${response.status}.`, 502)
    }

    const text = await response.text()
    return text.length === 0 ? {} : JSON.parse(text)
  }
}
