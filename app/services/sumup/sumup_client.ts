import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  TransactionStateResult,
} from './sumup_payload.js'

export interface SumUpReader {
  id: string
  name: string
  status: string
  deviceIdentifier: string | null
}

export default abstract class SumUpClient {
  /** Lance un paiement sur le lecteur. Accepté ≠ payé : l'issue arrive plus tard. */
  abstract createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>

  /** Interrompt un paiement en cours sur le lecteur. */
  abstract terminateCheckout(): Promise<void>

  /** La seule source de vérité sur l'issue d'un paiement. */
  abstract transactionState(clientTransactionId: string): Promise<TransactionStateResult>

  abstract listReaders(): Promise<SumUpReader[]>

  abstract pairReader(pairingCode: string, name: string): Promise<SumUpReader>
}
