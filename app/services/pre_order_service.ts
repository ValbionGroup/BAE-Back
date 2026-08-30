import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import PreOrder from '#models/pre_order'
import Event from '#models/event'
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
  /** Allergies et consignes déclarées par le client sur son profil. */
  preparationNote: string | null
  createdAt: string | null
}

/** En lot, comme `resolveBuyerNames`. */
async function preparationNotesOf(userIds: readonly number[]): Promise<Map<number, string>> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return new Map()

  const rows = await db
    .from('clients')
    .whereIn('id', unique)
    .whereNotNull('preparation_note')
    .select('id', 'preparation_note')

  return new Map(rows.map((row) => [Number(row.id), String(row.preparation_note)]))
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

  const userIds = preOrders.map((preOrder) => preOrder.userId)
  const [names, notes] = await Promise.all([
    resolveBuyerNames(userIds),
    preparationNotesOf(userIds),
  ])

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
      preparationNote: notes.get(preOrder.userId) ?? null,
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

/**
 * Pas des créneaux de retrait. Le client choisit un quart d'heure, pas une
 * minute : la cuisine sert par vagues, et un grain plus fin ne produirait
 * qu'une file impossible à préparer.
 */
export const PICKUP_SLOT_MINUTES = 15

/**
 * Durée retenue quand `events.duration` est nulle — la colonne est facultative
 * (`validators/event.ts`), et sans repli une soirée sans horaire de fin
 * n'offrirait aucun créneau du tout.
 *
 * ⚠️ `events.duration` est en **secondes**, comme l'écrit le front
 * (`(endMin - startMin) * 60`, `coordination-new-modal.ts`).
 */
export const DEFAULT_EVENT_DURATION_SECONDS = 4 * 60 * 60

export type PickupWindow = { start: DateTime; end: DateTime }

export function pickupWindowOf(date: DateTime, duration: number | null): PickupWindow {
  return { start: date, end: date.plus({ seconds: duration ?? DEFAULT_EVENT_DURATION_SECONDS }) }
}

/**
 * Un créneau vaut s'il tombe **dans** la soirée et **sur** un quart d'heure plein.
 *
 * Les deux chemins d'écriture passent par ici — la commande du client et la
 * correction du staff. Sans cela le client pourrait poser une heure que l'écran
 * d'administration ne saurait pas proposer, donc pas non plus reprendre.
 *
 * L'alignement se teste sur les minutes locales sans se soucier du fuseau : tous
 * les décalages en usage sont des multiples de 15 minutes, donc un quart d'heure
 * plein le reste d'un fuseau à l'autre.
 */
export function assertPickupSlot(pickupAt: DateTime, window: PickupWindow): void {
  if (
    pickupAt.minute % PICKUP_SLOT_MINUTES !== 0 ||
    pickupAt.second !== 0 ||
    pickupAt.millisecond !== 0
  ) {
    throw new ApiException(
      'E_PICKUP_SLOT_MISALIGNED',
      `L'heure de retrait doit tomber sur un créneau de ${PICKUP_SLOT_MINUTES} minutes.`,
      422
    )
  }

  if (pickupAt < window.start || pickupAt > window.end) {
    throw new ApiException(
      'E_PICKUP_SLOT_OUT_OF_RANGE',
      'Cette heure de retrait tombe en dehors de la soirée.',
      422
    )
  }
}

/**
 * Pose, déplace ou retire l'heure de retrait d'une précommande.
 *
 * Modifiable tant que la commande n'a pas été remise : un retard de cuisine se
 * répercute sur des créneaux déjà annoncés, c'est le cas d'usage principal.
 * `null` retire le créneau, ce qui remet la commande en tête de file
 * (`due` vaut alors `true`, cf. `kitchenTicketsFor`).
 */
export async function setPickupAt(
  preOrderId: number,
  pickupAt: string | null
): Promise<PreOrderTicket> {
  await db.transaction(async (trx) => {
    const preOrder = await PreOrder.query({ client: trx })
      .where('id', preOrderId)
      .preload('event')
      .forUpdate()
      .first()

    if (!preOrder) {
      throw new ApiException('E_PRE_ORDER_NOT_FOUND', "Cette précommande n'existe pas.", 404)
    }

    const rows = await trx.from('pre_order_items').where('pre_order_id', preOrderId)
    if (
      rows.length > 0 &&
      rows.every((row) => Number(row.received_quantity) >= Number(row.quantity))
    ) {
      throw new ApiException(
        'E_PRE_ORDER_ALREADY_COLLECTED',
        'Cette précommande a déjà été remise : son heure de retrait ne veut plus rien dire.',
        409
      )
    }

    if (pickupAt === null) {
      preOrder.pickupAt = null
    } else {
      const parsed = DateTime.fromISO(pickupAt)
      if (!parsed.isValid) {
        throw new ApiException('E_PICKUP_AT_INVALID', 'Cette heure de retrait est illisible.', 422)
      }

      assertPickupSlot(parsed, pickupWindowOf(preOrder.event.date, preOrder.event.duration))
      preOrder.pickupAt = parsed
    }

    await preOrder.save()
  })

  return findTicket(preOrderId)
}

/**
 * Même règle, appliquée au moment de la commande : le client choisit son
 * créneau avant que la précommande n'existe, donc avant qu'on puisse la charger.
 */
export async function assertPickupSlotForEvent(eventId: number, pickupAt: DateTime): Promise<void> {
  const event = await Event.find(eventId)
  if (!event) {
    throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
  }

  assertPickupSlot(pickupAt, pickupWindowOf(event.date, event.duration))
}
