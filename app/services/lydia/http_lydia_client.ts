import logger from '@adonisjs/core/services/logger'
import ApiException from '#exceptions/api_exception'
import LydiaClient from './lydia_client.js'
import {
  buildChargeQrCodeBody,
  buildDoBody,
  buildStateBody,
  parseChargeQrCodeResponse,
  parseDoResponse,
  parseStateResponse,
  type ChargeQrCodeInput,
  type ChargeQrCodeResult,
  type CreateRequestInput,
  type CreateRequestResult,
  type RequestStateResult,
} from './lydia_payload.js'

export function describeFetchFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'raison inconnue'

  const cause = error.cause
  if (!(cause instanceof Error)) return error.message

  const code = (cause as NodeJS.ErrnoException).code
  return `${error.message} (${code ?? cause.message})`
}

export default class HttpLydiaClient extends LydiaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly vendorToken: string
  ) {
    super()
  }

  async createRequest(input: CreateRequestInput): Promise<CreateRequestResult> {
    return parseDoResponse(
      await this.post('/api/request/do.json', buildDoBody(input, this.vendorToken))
    )
  }

  async requestState(requestUuid: string): Promise<RequestStateResult> {
    return parseStateResponse(
      await this.post('/api/request/state.json', buildStateBody(requestUuid, this.vendorToken))
    )
  }

  async chargeQrCode(input: ChargeQrCodeInput): Promise<ChargeQrCodeResult> {
    return parseChargeQrCodeResponse(
      await this.post('/api/payment/payment.json', buildChargeQrCodeBody(input, this.vendorToken))
    )
  }

  /**
   * Un corps non-JSON — page d'erreur, ou XML d'un endpoint appelé sans son
   * suffixe `.json` — remontait en 500 « Unexpected token '<' ». Il est
   * désormais journalisé : c'est la seule trace de ce que Lydia a répondu.
   */
  private async post(path: string, body: URLSearchParams): Promise<unknown> {
    let response: Response

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
    } catch (error) {
      logger.error(
        { err: error, url: `${this.baseUrl}${path}` },
        `Lydia injoignable : ${describeFetchFailure(error)}`
      )
      throw new ApiException('E_LYDIA_UNREACHABLE', 'Lydia est injoignable.', 502)
    }

    if (!response.ok) {
      throw new ApiException('E_LYDIA_UNREACHABLE', `Lydia a répondu ${response.status}.`, 502)
    }

    const raw = await response.text()
    try {
      return JSON.parse(raw)
    } catch {
      logger.error(
        { url: `${this.baseUrl}${path}`, body: raw.slice(0, 500) },
        'réponse Lydia illisible : du JSON était attendu'
      )
      throw new ApiException('E_LYDIA_UNREACHABLE', 'Lydia a répondu hors format.', 502)
    }
  }
}
