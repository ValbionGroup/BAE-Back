import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Event from '#models/event'
import Order from '#models/order'
import Transaction from '#models/transaction'
import ApiException from '#exceptions/api_exception'
import { ANONYMOUS_BUYER, resolveBuyerName, resolveBuyerNames } from '#services/buyer_service'
import { findCategory, gridOf } from '#services/sponsorship_service'

export const ORDER_STATUSES = ['pending', 'in_progress', 'ready', 'completed', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type PaymentMethod = 'cash' | 'lydia' | 'card'

/** Libellés lus au comptoir : un refus nomme un état, pas un code. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'en attente',
  in_progress: 'en préparation',
  ready: 'prête',
  completed: 'servie',
  cancelled: 'annulée',
}

/**
 * Le serveur arbitre, pas l'écran : caisse et cuisine regardent la même commande,
 * et sans cette table un rafraîchissement tardif la ferait reculer. Une commande
 * servie ne s'annule plus — ce serait un remboursement, pas une annulation.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

// `type` et non `interface` : seuls les alias reçoivent une signature d'index
// implicite, sans laquelle ces charges utiles ne satisfont pas le
// `Broadcastable` de Transmit (`orders_realtime.ts`).
export type OrderLinePayload = {
  productId: number
  productName: string
  quantity: number
  /** En **centimes**, figé à la vente (`order_products.unit_price_cents`). */
  unitPrice: number
  /** Prix public du moment. Égal à `unitPrice` tant qu'aucune remise n'existe. */
  listPrice: number
}

export type OrderDiscountPayload = {
  /** `null` pour une remise portant sur toute la commande. */
  productId: number | null
  label: string
  amountCents: number
}

export type OrderSponsorship = {
  categoryId: number | null
  label: string
  payerName: string | null
}

export type OrderPayload = {
  id: number
  /** Dérivé par soirée — voir `numberOf`. Aucune colonne ne le porte. */
  number: number
  eventId: number | null
  status: string
  clientName: string
  lines: OrderLinePayload[]
  discounts: OrderDiscountPayload[]
  sponsorship: OrderSponsorship | null
  /** Σ lignes au prix public. */
  grossCents: number
  /** Remise consentie : du chiffre d'affaires perdu. */
  discountCents: number
  /** Écart pris en charge par un tiers : à recouvrer, pas perdu. */
  sponsoredCents: number
  /** Ce qui a été encaissé au comptoir. */
  totalCents: number
  createdAt: string | null
  /** Dernière transition — alimente le temps moyen de préparation. */
  updatedAt: string | null
}

export interface CheckoutLine {
  productId: number
  quantity: number
}

interface MenuEntry {
  price: number
  name: string
}

/** ⚠️ `price` est un entier **en centimes** ; `transactions.amount` est en euros. */
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
 * Dérivé plutôt que stocké : on annule une commande sans la supprimer, donc
 * aucune ligne ne disparaît et la numérotation reste stable.
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

/**
 * Un écart entre prix public et prix facturé est une **créance** quand la
 * commande porte une catégorie de prise en charge, une **remise consentie**
 * sinon. Les deux se ressemblent au comptoir et s'opposent au bilan, d'où
 * l'invariant `gross = total + discount + sponsored`.
 */
function buildPayload(
  order: Order,
  lines: readonly OrderLinePayload[],
  discounts: readonly OrderDiscountPayload[],
  orderNumber: number,
  clientName: string
): OrderPayload {
  const sorted = [...lines].sort((a, b) => a.productName.localeCompare(b.productName, 'fr'))

  const grossCents = sorted.reduce((sum, line) => sum + line.listPrice * line.quantity, 0)
  const chargedCents = sorted.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  const orderDiscountCents = discounts.reduce((sum, entry) => sum + entry.amountCents, 0)
  const totalCents = chargedCents - orderDiscountCents

  // `!= null` et non `!== null` : une commande fraîchement créée porte
  // `undefined`, jamais `null`.
  // eslint-disable-next-line eqeqeq
  const sponsored = order.sponsorshipCategoryLabel != null
  const sponsoredCents = sponsored ? grossCents - chargedCents : 0

  return {
    id: order.id,
    number: orderNumber,
    eventId: order.eventId,
    status: order.status,
    clientName,
    lines: sorted,
    discounts: [...discounts],
    sponsorship: sponsored
      ? {
          categoryId: order.sponsorshipCategoryId,
          label: order.sponsorshipCategoryLabel!,
          payerName: order.payerName,
        }
      : null,
    grossCents,
    discountCents: grossCents - totalCents - sponsoredCents,
    sponsoredCents,
    totalCents,
    createdAt: order.createdAt?.toISO() ?? null,
    updatedAt: order.updatedAt?.toISO() ?? null,
  }
}

/** Les lignes telles qu'écrites, prix compris — jamais relues du menu actuel. */
async function storedLinesOf(
  orderIds: readonly number[],
  trx?: TransactionClientContract
): Promise<Map<number, OrderLinePayload[]>> {
  const byOrder = new Map<number, OrderLinePayload[]>(orderIds.map((id) => [id, []]))
  if (orderIds.length === 0) return byOrder

  const rows = await (trx ?? db)
    .from('order_products')
    .join('products', 'products.id', 'order_products.product_id')
    .whereIn('order_products.order_id', [...orderIds])
    .select(
      'order_products.order_id',
      'order_products.product_id',
      'order_products.quantity',
      'order_products.unit_price_cents',
      'order_products.list_price_cents',
      'products.name'
    )

  for (const row of rows) {
    byOrder.get(Number(row.order_id))?.push({
      productId: Number(row.product_id),
      productName: String(row.name),
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price_cents),
      listPrice: Number(row.list_price_cents),
    })
  }

  return byOrder
}

async function discountsOf(
  orderIds: readonly number[],
  trx?: TransactionClientContract
): Promise<Map<number, OrderDiscountPayload[]>> {
  const byOrder = new Map<number, OrderDiscountPayload[]>(orderIds.map((id) => [id, []]))
  if (orderIds.length === 0) return byOrder

  const rows = await (trx ?? db)
    .from('order_discounts')
    .whereIn('order_id', [...orderIds])
    .orderBy('id', 'asc')
    .select('order_id', 'product_id', 'label', 'amount_cents')

  for (const row of rows) {
    byOrder.get(Number(row.order_id))?.push({
      productId: row.product_id === null ? null : Number(row.product_id),
      label: String(row.label),
      amountCents: Number(row.amount_cents),
    })
  }

  return byOrder
}

async function assertSellable(
  quantities: Map<number, number>,
  eventId: number,
  menu: Map<number, { name: string }>,
  trx: TransactionClientContract
): Promise<void> {
  const productIds = [...quantities.keys()]

  const produced = await trx
    .from('production_runs')
    .where('event_id', eventId)
    .whereIn('product_id', productIds)
    .groupBy('product_id')
    .select('product_id')
    .sum('quantity as total')

  const sold = await trx
    .from('order_products')
    .join('orders', 'orders.id', 'order_products.order_id')
    .where('orders.event_id', eventId)
    .whereNot('orders.status', 'cancelled')
    .whereIn('order_products.product_id', productIds)
    .groupBy('order_products.product_id')
    .select('order_products.product_id')
    .sum('order_products.quantity as total')

  const producedBy = new Map(produced.map((row) => [Number(row.product_id), Number(row.total)]))
  const soldBy = new Map(sold.map((row) => [Number(row.product_id), Number(row.total)]))

  for (const [productId, quantity] of quantities) {
    const producedQty = producedBy.get(productId) ?? 0
    if (producedQty === 0) continue

    const remaining = Math.max(0, producedQty - (soldBy.get(productId) ?? 0))
    if (quantity <= remaining) continue

    const label = menu.get(productId)?.name ?? `#${productId}`
    throw new ApiException(
      'E_INSUFFICIENT_STOCK',
      remaining === 0
        ? `« ${label} » est en rupture : relancez une production avant de vendre.`
        : `Il ne reste que ${remaining} « ${label} » : impossible d'en vendre ${quantity}.`,
      422
    )
  }
}

export interface OrderDraft {
  eventId: number
  lines: OrderLinePayload[]
  totalCents: number
  sponsorship: { categoryId: number; label: string; payerName: string | null } | null
}

export async function priceCart(
  eventId: number,
  lines: readonly CheckoutLine[],
  sponsorshipCategoryId: number | null,
  trx: TransactionClientContract
): Promise<OrderDraft> {
  const quantities = mergeLines(lines)

  const event = await Event.query({ client: trx }).where('id', eventId).forUpdate().first()
  if (!event) {
    throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
  }

  const menu = await menuOf(eventId, trx)

  const category = sponsorshipCategoryId ? await findCategory(eventId, sponsorshipCategoryId) : null
  const grid = category ? await gridOf(category.id, trx) : new Map<number, number>()

  const priced: OrderLinePayload[] = []
  let totalCents = 0
  for (const [productId, quantity] of quantities) {
    const entry = menu.get(productId)
    if (!entry) {
      const row = await trx.from('products').where('id', productId).select('name').first()
      const label = row ? String(row.name) : `#${productId}`
      throw new ApiException(
        'E_PRODUCT_NOT_ON_MENU',
        `« ${label} » n'est pas au menu de cette soirée.`,
        422
      )
    }

    const unitPrice = grid.get(productId) ?? entry.price
    totalCents += unitPrice * quantity
    priced.push({
      productId,
      productName: entry.name,
      quantity,
      unitPrice,
      listPrice: entry.price,
    })
  }

  await assertSellable(quantities, eventId, menu, trx)

  return {
    eventId,
    lines: priced,
    totalCents,
    sponsorship: category
      ? { categoryId: category.id, label: category.label, payerName: event.payerName }
      : null,
  }
}

/** Écrit la transaction comptable, la commande et ses lignes. */
export async function writeOrder(
  draft: OrderDraft,
  memberId: number | null,
  clientId: number | null,
  paymentMethod: PaymentMethod,
  trx: TransactionClientContract
): Promise<OrderPayload> {
  const transaction = new Transaction()
  transaction.useTransaction(trx)
  transaction.type = paymentMethod
  // Centimes → euros, en chaîne : `decimal` transite en string dans les deux sens.
  transaction.amount = (draft.totalCents / 100).toFixed(2)
  await transaction.save()

  const order = new Order()
  order.useTransaction(trx)
  order.eventId = draft.eventId
  order.memberId = memberId
  order.clientId = clientId
  order.transactionId = transaction.id
  order.status = 'pending'
  if (draft.sponsorship) {
    order.sponsorshipCategoryId = draft.sponsorship.categoryId
    order.sponsorshipCategoryLabel = draft.sponsorship.label
    order.payerName = draft.sponsorship.payerName
  }
  await order.save()

  await trx.table('order_products').insert(
    draft.lines.map((line) => ({
      order_id: order.id,
      product_id: line.productId,
      quantity: line.quantity,
      unit_price_cents: line.unitPrice,
      list_price_cents: line.listPrice,
    }))
  )

  const names = await resolveBuyerNames(clientId === null ? [] : [clientId], trx)
  const clientName = clientId === null ? ANONYMOUS_BUYER : (names.get(clientId) ?? ANONYMOUS_BUYER)

  return buildPayload(order, draft.lines, [], await numberOf(order, trx), clientName)
}

export async function checkout(
  eventId: number,
  lines: readonly CheckoutLine[],
  memberId: number | null,
  clientId: number | null,
  paymentMethod: PaymentMethod = 'cash',
  sponsorshipCategoryId: number | null = null
): Promise<OrderPayload> {
  return db.transaction(async (trx) => {
    const draft = await priceCart(eventId, lines, sponsorshipCategoryId, trx)
    return writeOrder(draft, memberId, clientId, paymentMethod, trx)
  })
}

export async function listForEvent(eventId: number): Promise<OrderPayload[]> {
  const orders = await Order.query().where('eventId', eventId).orderBy('id', 'asc')
  if (orders.length === 0) return []

  const orderIds = orders.map((order) => order.id)
  const [lines, discounts] = await Promise.all([storedLinesOf(orderIds), discountsOf(orderIds)])

  const clientIds = orders
    .map((order) => order.clientId)
    .filter((id): id is number => id !== null && id !== undefined)
  const names = await resolveBuyerNames(clientIds)

  return orders
    .map((order, index) =>
      buildPayload(
        order,
        lines.get(order.id) ?? [],
        discounts.get(order.id) ?? [],
        index + 1,
        order.clientId === null || order.clientId === undefined
          ? ANONYMOUS_BUYER
          : (names.get(order.clientId) ?? ANONYMOUS_BUYER)
      )
    )
    .reverse()
}

export interface SellableLine {
  productId: number
  productName: string
  /** Quantité inscrite au menu de la soirée (`event_products.quantity`). */
  plannedQty: number
  /** Ce que la cuisine a réellement assemblé (`Σ production_runs.quantity`). */
  producedQty: number
  /** Ce qui a été vendu, **commandes annulées exclues**. */
  soldQty: number
  remainingQty: number
}

export async function sellableForEvent(eventId: number): Promise<SellableLine[]> {
  const menuRows = await db
    .from('event_products')
    .join('products', 'products.id', 'event_products.product_id')
    .where('event_products.event_id', eventId)
    .select('event_products.product_id', 'event_products.quantity', 'products.name')
    .orderBy('products.name')

  if (menuRows.length === 0) return []

  const produced = await db
    .from('production_runs')
    .where('event_id', eventId)
    .groupBy('product_id')
    .select('product_id')
    .sum('quantity as total')

  const sold = await db
    .from('order_products')
    .join('orders', 'orders.id', 'order_products.order_id')
    .where('orders.event_id', eventId)
    .whereNot('orders.status', 'cancelled')
    .groupBy('order_products.product_id')
    .select('order_products.product_id')
    .sum('order_products.quantity as total')

  const producedBy = new Map(produced.map((row) => [Number(row.product_id), Number(row.total)]))
  const soldBy = new Map(sold.map((row) => [Number(row.product_id), Number(row.total)]))

  return menuRows.map((row) => {
    const productId = Number(row.product_id)
    const producedQty = producedBy.get(productId) ?? 0
    const soldQty = soldBy.get(productId) ?? 0

    return {
      productId,
      productName: String(row.name),
      plannedQty: Number(row.quantity),
      producedQty,
      soldQty,
      remainingQty: Math.max(0, producedQty - soldQty),
    }
  })
}

/** Recompose la charge utile d'une commande déjà écrite. */
async function payloadOf(order: Order): Promise<OrderPayload> {
  const [lines, discounts] = await Promise.all([storedLinesOf([order.id]), discountsOf([order.id])])

  return buildPayload(
    order,
    lines.get(order.id) ?? [],
    discounts.get(order.id) ?? [],
    await numberOf(order),
    await resolveBuyerName(order.clientId ?? null)
  )
}

export function assertTransition(from: string, to: OrderStatus): void {
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
 * Statut relu sous verrou de ligne : deux postes validant simultanément la même
 * commande verraient sinon tous deux l'état d'avant.
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

/** Une transition, pas une suppression : la ligne reste, la numérotation tient. */
export async function cancel(orderId: number): Promise<OrderPayload> {
  return setStatus(orderId, 'cancelled')
}
