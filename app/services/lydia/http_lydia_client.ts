import logger from '@adonisjs/core/services/logger'
import ApiException from '#exceptions/api_exception'
import LydiaClient from './lydia_client.js'
import {
  buildDoBody,
  buildStateBody,
  parseDoResponse,
  parseStateResponse,
  type CreateRequestInput,
  type CreateRequestResult,
  type RequestStateResult,
} from './lydia_payload.js'

/**
 * Ce que `fetch` a réellement refusé.
 *
 * Undici range la vraie raison dans `cause` — `ENOTFOUND`, `ECONNREFUSED`,
 * `ETIMEDOUT`, certificat rejeté — là où le message de surface se réduit
 * toujours à « fetch failed ». Quatre pannes qui n'ont pas le même correctif.
 */
export function describeFetchFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'raison inconnue'

  const cause = error.cause
  if (!(cause instanceof Error)) return error.message

  const code = (cause as NodeJS.ErrnoException).code
  return `${error.message} (${code ?? cause.message})`
}

/**
 * Le vrai Lydia. Volontairement mince : tout ce qui se décide — la forme du
 * corps, la lecture des réponses — vit dans `lydia_payload`, qui se teste sans
 * réseau. Il ne reste ici que le transport.
 */
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

  private async post(path: string, body: URLSearchParams): Promise<unknown> {
    let response: Response

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
    } catch (error) {
      // Le message rendu au client reste générique ; la cause part au journal.
      // Les deux n'ont ni le même lecteur ni la même menace, et les confondre
      // condamne à deviner : le jeton de commerçant voyage dans le **corps**,
      // jamais dans l'URL ni dans une erreur de transport.
      logger.error(
        { err: error, url: `${this.baseUrl}${path}` },
        `Lydia injoignable : ${describeFetchFailure(error)}`
      )
      throw new ApiException('E_LYDIA_UNREACHABLE', 'Lydia est injoignable.', 502)
    }

    if (!response.ok) {
      throw new ApiException('E_LYDIA_UNREACHABLE', `Lydia a répondu ${response.status}.`, 502)
    }

    return response.json()
  }
}
