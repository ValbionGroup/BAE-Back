import PreOrder from '#models/pre_order'
import ApiException from '#exceptions/api_exception'

export type PreOrderLine = {
  productId: number
  productName: string
  quantity: number
  /** Déjà remis. `pre_order_items.received_quantity` porte le retrait partiel. */
  receivedQuantity: number
}

export type PreOrderPickup = {
  id: number
  eventId: number
  eventName: string
  /**
   * Une précommande est **censée** être payée à la commande — mais
   * `pre_orders.transaction_id` est nullable et rien ne l'impose encore (aucun
   * contrôleur, aucun flux de paiement). Le drapeau existe donc pour l'anomalie :
   * un paiement interrompu ne doit pas se traduire par une remise gratuite.
   */
  paid: boolean
  lines: PreOrderLine[]
  /** Tout a déjà été remis — la seconde présentation du même QR ne livre rien. */
  fullyCollected: boolean
}

/**
 * La précommande désignée par un QR, telle qu'on la lit au comptoir.
 *
 * ⚠️ **Lecture seule.** Rien n'est marqué comme remis ici : incrémenter
 * `received_quantity` est le geste de retrait, et il n'existe pas encore
 * (§11.3). Tant qu'il manque, le même QR reste présentable plusieurs fois —
 * d'où `fullyCollected`, qui dit au moins ce qui a déjà été livré.
 */
export async function pickupFor(preOrderId: number, userId: number): Promise<PreOrderPickup> {
  const preOrder = await PreOrder.query()
    .where('id', preOrderId)
    .preload('event')
    .preload('products')
    .first()

  if (!preOrder) {
    throw new ApiException('E_PRE_ORDER_NOT_FOUND', "Cette précommande n'existe pas.", 404)
  }

  // Le QR porte son propriétaire : un jeton signé pour un autre compte ne doit
  // pas ouvrir une précommande qui ne lui appartient pas.
  if (preOrder.userId !== userId) {
    throw new ApiException(
      'E_PRE_ORDER_MISMATCH',
      'Ce QR ne correspond pas au propriétaire de cette précommande.',
      403
    )
  }

  const lines: PreOrderLine[] = preOrder.products.map((product) => ({
    productId: product.id,
    productName: product.name,
    quantity: Number(product.$extras.pivot_quantity),
    receivedQuantity: Number(product.$extras.pivot_received_quantity),
  }))

  return {
    id: preOrder.id,
    eventId: preOrder.eventId,
    eventName: preOrder.event?.name ?? `Soirée #${preOrder.eventId}`,
    paid: preOrder.transactionId !== null && preOrder.transactionId !== undefined,
    lines,
    fullyCollected: lines.length > 0 && lines.every((l) => l.receivedQuantity >= l.quantity),
  }
}
