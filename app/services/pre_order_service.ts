import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import PreOrder from '#models/pre_order'
import ApiException from '#exceptions/api_exception'
import { assertTransition, type OrderStatus } from '#services/order_service'
import { resolveBuyerNames } from '#services/buyer_service'

/**
 * Délai de préparation : une précommande entre dans « À faire » ce nombre de
 * minutes avant son heure de retrait.
 *
 * Une précommande **sans** heure (`pickup_at` nul) est due dès l'ouverture :
 * mieux vaut la préparer trop tôt que la voir disparaître de la file.
 */
export const PREPARE_LEAD_MINUTES = 15

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

export type PreOrderTicket = {
  id: number
  /** Repère lisible au comptoir. Préfixé pour ne pas se confondre avec une commande. */
  reference: string
  eventId: number
  status: string
  clientName: string
  lines: PreOrderLine[]
  paid: boolean
  fullyCollected: boolean
  /** ISO, ou `null` quand le client n'a pas choisi d'heure. */
  pickupAt: string | null
  /** L'heure approche : la cuisine doit s'y mettre. */
  due: boolean
  createdAt: string | null
}

/**
 * Les précommandes d'une soirée, vues depuis la cuisine.
 *
 * ⚠️ Elles ne comptent **ni dans la recette du soir ni dans les temps** : elles
 * ont été payées un autre jour, et leur délai se mesure à l'heure de retrait
 * choisie par le client, pas au rythme du service.
 */
export async function kitchenTicketsFor(
  eventId: number,
  now: DateTime = DateTime.now()
): Promise<PreOrderTicket[]> {
  const preOrders = await PreOrder.query()
    .where('eventId', eventId)
    .preload('products')
    .orderBy('id', 'asc')

  if (preOrders.length === 0) return []

  const names = await resolveBuyerNames(preOrders.map((preOrder) => preOrder.userId))

  return preOrders.map((preOrder, index) => {
    const lines: PreOrderLine[] = preOrder.products.map((product) => ({
      productId: product.id,
      productName: product.name,
      quantity: Number(product.$extras.pivot_quantity),
      receivedQuantity: Number(product.$extras.pivot_received_quantity),
    }))

    const pickupAt = preOrder.pickupAt
    const due =
      pickupAt === null ? true : pickupAt.diff(now, 'minutes').minutes <= PREPARE_LEAD_MINUTES

    return {
      id: preOrder.id,
      reference: `P${index + 1}`,
      eventId: preOrder.eventId,
      status: preOrder.status,
      clientName: names.get(preOrder.userId) ?? `Client #${preOrder.userId}`,
      lines,
      paid: preOrder.transactionId !== null && preOrder.transactionId !== undefined,
      fullyCollected: lines.length > 0 && lines.every((l) => l.receivedQuantity >= l.quantity),
      pickupAt: pickupAt?.toISO() ?? null,
      due,
      createdAt: preOrder.createdAt?.toISO() ?? null,
    }
  })
}

async function findTicket(preOrderId: number): Promise<PreOrderTicket> {
  const preOrder = await PreOrder.find(preOrderId)
  if (!preOrder) {
    throw new ApiException('E_PRE_ORDER_NOT_FOUND', "Cette précommande n'existe pas.", 404)
  }
  const tickets = await kitchenTicketsFor(preOrder.eventId)
  return tickets.find((ticket) => ticket.id === preOrderId)!
}

/** Même table de transitions que les commandes : la cuisine ne distingue pas les deux. */
export async function setPreOrderStatus(
  preOrderId: number,
  next: OrderStatus
): Promise<PreOrderTicket> {
  await db.transaction(async (trx) => {
    const locked = await PreOrder.query({ client: trx }).where('id', preOrderId).forUpdate().first()
    if (!locked) {
      throw new ApiException('E_PRE_ORDER_NOT_FOUND', "Cette précommande n'existe pas.", 404)
    }

    assertTransition(locked.status, next)
    locked.status = next
    await locked.save()
  })

  return findTicket(preOrderId)
}

/**
 * Remet la commande au client — **tout d'un coup**.
 *
 * Le grain de `received_quantity` autorise une remise partielle, mais le
 * comptoir n'en offre pas : sous la pression d'un service, une commande à
 * moitié ouverte est un enregistrement que personne ne réconcilie. La colonne
 * reste au grain fin pour le jour où le besoin se présentera vraiment.
 */
export async function collect(preOrderId: number): Promise<PreOrderTicket> {
  await db.transaction(async (trx) => {
    const preOrder = await PreOrder.query({ client: trx })
      .where('id', preOrderId)
      .forUpdate()
      .first()

    if (!preOrder) {
      throw new ApiException('E_PRE_ORDER_NOT_FOUND', "Cette précommande n'existe pas.", 404)
    }

    if (preOrder.transactionId === null || preOrder.transactionId === undefined) {
      throw new ApiException(
        'E_PRE_ORDER_UNPAID',
        "Aucun paiement n'est rattaché à cette précommande : elle ne peut pas être remise.",
        409
      )
    }

    const rows = await trx.from('pre_order_items').where('pre_order_id', preOrderId)
    if (rows.every((row) => Number(row.received_quantity) >= Number(row.quantity))) {
      throw new ApiException(
        'E_PRE_ORDER_ALREADY_COLLECTED',
        'Cette précommande a déjà été entièrement remise.',
        409
      )
    }

    await trx
      .from('pre_order_items')
      .where('pre_order_id', preOrderId)
      .update({ received_quantity: db.raw('quantity'), updated_at: DateTime.now().toSQL() })

    preOrder.status = 'completed'
    await preOrder.save()
  })

  return findTicket(preOrderId)
}
