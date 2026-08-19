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
    } catch {
      // L'erreur d'origine n'est pas propagée : elle porterait l'URL, donc le
      // jeton de commerçant si Lydia le renvoyait dans un message.
      throw new ApiException('E_LYDIA_UNREACHABLE', 'Lydia est injoignable.', 502)
    }

    if (!response.ok) {
      throw new ApiException('E_LYDIA_UNREACHABLE', `Lydia a répondu ${response.status}.`, 502)
    }

    return response.json()
  }
}
