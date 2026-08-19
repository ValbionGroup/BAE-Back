import type {
  CreateRequestInput,
  CreateRequestResult,
  RequestStateResult,
} from './lydia_payload.js'

/**
 * Classe abstraite plutôt qu'interface : elle sert de jeton au conteneur, ce qui
 * permet aux tests de substituer l'implémentation simulée sans variable globale
 * ni crochet de test dans le code de production.
 */
export default abstract class LydiaClient {
  abstract createRequest(input: CreateRequestInput): Promise<CreateRequestResult>
  abstract requestState(requestUuid: string): Promise<RequestStateResult>
}
