import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Event from '#models/event'
import Order from '#models/order'
import Transaction from '#models/transaction'
import ApiException from '#exceptions/api_exception'
import { ANONYMOUS_BUYER, resolveBuyerName, resolveBuyerNames } from '#services/buyer_service'

export const ORDER_STATUSES = ['pending', 'in_progress', 'ready', 'completed', 'cancelled'] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Libellés lus au comptoir : les refus doivent nommer des états, pas des codes. */
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'en attente',
  in_progress: 'en préparation',
  ready: 'prête',
  completed: 'servie',
  cancelled: 'annulée',
}

/**
 * Transitions légales. **Le serveur arbitre, pas l'écran.**
 *
 * La caisse et la cuisine regardent la même commande : sans cette table, un
 * rafraîchissement tardif d'un des deux postes ferait reculer une commande déjà
 * prête. Le `nextStatus()` du front reste un confort d'interface — il décide
 * quel bouton afficher, pas ce qui est permis.
 *
 * `completed` et `cancelled` sont terminaux : une commande servie ne s'annule
 * plus (l'argent est encaissé, le geste serait un remboursement, pas une
 * annulation).
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export interface OrderLinePayload {
  productId: number
  productName: string
  quantity: number
  /** En **centimes**, relu du menu de la soirée. */
  unitPrice: number
}

export interface OrderPayload {
  id: number
  /** Dérivé par soirée — voir `numberOf`. Aucune colonne ne le porte. */
  number: number
  eventId: number | null
  status: string
  clientName: string
  lines: OrderLinePayload[]
  totalCents: number
  createdAt: string | null
}

export interface CheckoutLine {
  productId: number
  quantity: number
}

interface MenuEntry {
  price: number
  name: string
}

/**
 * Prix de vente et libellé de chaque recette au menu d'une soirée.
 *
 * ⚠️ `event_products.price` est un entier **en centimes**. `transactions.amount`
 * est un `decimal(10,2)` **en euros** : la conversion se fait au moment d'écrire
 * la transaction, jamais avant.
 */
async function menuOf(
  eventId: number,
  trx?: TransactionClientContract
): Promise<Map<number, MenuEntry>> {
  const rows = await (trx ?? db)
    .from('event_products')
    .join('products', 'products.id', 'event_products.product_id')
    .where('event_products.event_id', eventId)
    .select('event_products.product_id', 'event_products.price', 'products.name')

  return new Map(
    rows.map((row) => [
      Number(row.product_id),
      { price: Number(row.price), name: String(row.name) },
    ])
  )
}

/**
 * Rang de la commande dans sa soirée.
 *
 * Dérivé plutôt que stocké : on **annule** une commande (statut `cancelled`), on
 * ne la supprime pas, donc les lignes ne disparaissent jamais et la numérotation
 * reste stable. Ajouter une colonne ne servirait qu'à la maintenir à la main.
 */
async function numberOf(order: Order, trx?: TransactionClientContract): Promise<number> {
  const row = await (trx ?? db)
    .from('orders')
    .where('event_id', order.eventId!)
    .where('id', '<=', order.id)
    .count('* as total')
    .first()

  return Number(row?.total ?? 1)
}

/** Fusionne les lignes par produit et refuse les quantités non positives. */
function mergeLines(lines: readonly CheckoutLine[]): Map<number, number> {
  const merged = new Map<number, number>()
  for (const line of lines) {
    if (line.quantity <= 0) {
      throw new ApiException('E_ORDER_INVALID_QUANTITY', 'Une quantité doit être positive.', 422)
    }
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity)
  }
  return merged
}

function buildPayload(
  order: Order,
  quantities: Map<number, number>,
  menu: Map<number, MenuEntry>,
  orderNumber: number,
  clientName: string
): OrderPayload {
  const lines: OrderLinePayload[] = []
  let totalCents = 0

  for (const [productId, quantity] of quantities) {
    const entry = menu.get(productId)
    const unitPrice = entry?.price ?? 0
    totalCents += unitPrice * quantity
    lines.push({
      productId,
      productName: entry?.name ?? `Produit #${productId}`,
      quantity,
      unitPrice,
    })
  }

  lines.sort((a, b) => a.productName.localeCompare(b.productName, 'fr'))

  return {
    id: order.id,
    number: orderNumber,
    eventId: order.eventId,
    status: order.status,
    clientName,
    lines,
    totalCents,
    createdAt: order.createdAt?.toISO() ?? null,
  }
}

/**
 * Enregistre une commande encaissée : transaction, commande et lignes en **une
 * seule écriture atomique**. Un échec à mi-chemin laisserait sinon soit de
 * l'argent sans commande, soit une commande sans argent.
 */
export async function checkout(
  eventId: number,
  lines: readonly CheckoutLine[],
  memberId: number | null,
  clientId: number | null
): Promise<OrderPayload> {
  const quantities = mergeLines(lines)

  return db.transaction(async (trx) => {
    const event = await Event.query({ client: trx }).where('id', eventId).first()
    if (!event) {
      throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
    }

    const menu = await menuOf(eventId, trx)

    // Le total est **recalculé** depuis le menu de la soirée. Rien de ce que le
    // client envoie sur le prix n'est lu : c'est de l'argent.
    let totalCents = 0
    for (const [productId, quantity] of quantities) {
      const entry = menu.get(productId)
      if (!entry) {
        // Nommer le produit plutôt que d'afficher son id : le refus se lit au
        // comptoir, où personne ne connaît les identifiants.
        const row = await trx.from('products').where('id', productId).select('name').first()
        const label = row ? String(row.name) : `#${productId}`
        throw new ApiException(
          'E_PRODUCT_NOT_ON_MENU',
          `« ${label} » n'est pas au menu de cette soirée.`,
          422
        )
      }
      totalCents += entry.price * quantity
    }

    const transaction = new Transaction()
    transaction.useTransaction(trx)
    transaction.type = 'cash'
    // Centimes → euros, et en **chaîne** : `amount` est un `decimal(10,2)`, que
    // le driver rend en string dans les deux sens. `toFixed(2)` fixe la forme
    // exacte de la colonne au lieu de laisser un flottant s'y approcher.
    transaction.amount = (totalCents / 100).toFixed(2)
    await transaction.save()

    const order = new Order()
    order.useTransaction(trx)
    order.eventId = eventId
    order.memberId = memberId
    order.clientId = clientId
    order.transactionId = transaction.id
    order.status = 'pending'
    await order.save()

    await trx.table('order_products').insert(
      [...quantities].map(([productId, quantity]) => ({
        order_id: order.id,
        product_id: productId,
        quantity,
      }))
    )

    const names = await resolveBuyerNames(clientId === null ? [] : [clientId], trx)
    const clientName =
      clientId === null ? ANONYMOUS_BUYER : (names.get(clientId) ?? ANONYMOUS_BUYER)

    return buildPayload(order, quantities, menu, await numberOf(order, trx), clientName)
  })
}

/**
 * Les commandes d'une soirée, plus récentes d'abord.
 *
 * ⚠️ Le prix unitaire affiché est relu du menu **actuel**. Les prix étant fixés
 * par soirée et réputés stables, c'est assumé ; le chiffre d'argent qui fait foi
 * reste `transactions.amount`, figé à l'encaissement.
 */
export async function listForEvent(eventId: number): Promise<OrderPayload[]> {
  const orders = await Order.query().where('eventId', eventId).orderBy('id', 'asc')
  if (orders.length === 0) return []

  const menu = await menuOf(eventId)

  const pivots = await db
    .from('order_products')
    .whereIn(
      'order_id',
      orders.map((order) => order.id)
    )
    .select('order_id', 'product_id', 'quantity')

  const byOrder = new Map<number, Map<number, number>>()
  for (const row of pivots) {
    const orderId = Number(row.order_id)
    if (!byOrder.has(orderId)) byOrder.set(orderId, new Map())
    byOrder.get(orderId)!.set(Number(row.product_id), Number(row.quantity))
  }

  const clientIds = orders
    .map((order) => order.clientId)
    .filter((id): id is number => id !== null && id !== undefined)
  const names = await resolveBuyerNames(clientIds)

  // Le numéro est le rang dans la soirée : les commandes sont déjà triées par id.
  return orders
    .map((order, index) =>
      buildPayload(
        order,
        byOrder.get(order.id) ?? new Map(),
        menu,
        index + 1,
        order.clientId === null || order.clientId === undefined
          ? ANONYMOUS_BUYER
          : (names.get(order.clientId) ?? ANONYMOUS_BUYER)
      )
    )
    .reverse()
}

/** Recompose la charge utile d'une commande déjà écrite. */
async function payloadOf(order: Order): Promise<OrderPayload> {
  const menu = await menuOf(order.eventId!)

  const pivots = await db
    .from('order_products')
    .where('order_id', order.id)
    .select('product_id', 'quantity')

  const quantities = new Map(
    pivots.map((row) => [Number(row.product_id), Number(row.quantity)] as const)
  )

  return buildPayload(
    order,
    quantities,
    menu,
    await numberOf(order),
    await resolveBuyerName(order.clientId ?? null)
  )
}

function assertTransition(from: string, to: OrderStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from as OrderStatus] ?? []
  if (allowed.includes(to)) return

  const fromLabel = STATUS_LABELS[from as OrderStatus] ?? from
  throw new ApiException(
    'E_ORDER_INVALID_TRANSITION',
    `Une commande ${fromLabel} ne peut pas passer ${STATUS_LABELS[to]}.`,
    409
  )
}

/**
 * Fait avancer une commande, en refusant toute transition illégale.
 *
 * Le statut est relu **dans la transaction**, sous verrou de ligne : deux postes
 * qui valident simultanément la même commande verraient sinon tous deux l'état
 * d'avant et la feraient avancer deux fois.
 */
export async function setStatus(orderId: number, next: OrderStatus): Promise<OrderPayload> {
  const order = await db.transaction(async (trx) => {
    const locked = await Order.query({ client: trx }).where('id', orderId).forUpdate().first()
    if (!locked) {
      throw new ApiException('E_ORDER_NOT_FOUND', "Cette commande n'existe pas.", 404)
    }

    assertTransition(locked.status, next)

    locked.status = next
    await locked.save()
    return locked
  })

  return payloadOf(order)
}

/**
 * Annule une commande. C'est une **transition**, pas une suppression : la ligne
 * reste en base, ce qui garde la numérotation par soirée stable et laisse une
 * trace de ce qui a été encaissé puis rendu.
 */
export async function cancel(orderId: number): Promise<OrderPayload> {
  return setStatus(orderId, 'cancelled')
}
