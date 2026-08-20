import type {
  CreateRequestInput,
  CreateRequestResult,
  RequestStateResult,
} from './lydia_payload.js'

export default abstract class LydiaClient {
  abstract createRequest(input: CreateRequestInput): Promise<CreateRequestResult>
  abstract requestState(requestUuid: string): Promise<RequestStateResult>
}
