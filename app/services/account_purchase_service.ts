import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import JwtService from '#services/jwt_service'
import PreOrder from '#models/pre_order'
import Subscription from '#models/subscription'
import ApiException from '#exceptions/api_exception'
import { toView, type SubscriptionView } from '#services/subscription_service'

export interface MyPreOrderLine {
  productId: number
  productName: string
  quantity: number
  receivedQuantity: number
  unitPrice: number
}

export interface MyPreOrderView {
  id: number
  reference: string
  eventId: number
  eventName: string
  eventDate: string | null
  status: string
  lines: MyPreOrderLine[]
  totalCents: number
  paid: boolean
  fullyCollected: boolean
  pickupAt: string | null
  createdAt: string | null
}

function referenceOf(id: number, createdAt: string | null): string {
  const year = createdAt === null ? new Date().getFullYear() : new Date(createdAt).getFullYear()
  return `BAE-${year}-${String(id).padStart(4, '0')}`
}

async function menusOf(eventIds: number[]): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map()

  const rows = await db
    .from('event_products')
    .whereIn('event_id', eventIds)
    .select('event_id', 'product_id', 'price')

  return new Map(rows.map((row) => [`${row.event_id}:${row.product_id}`, Number(row.price)]))
}

function buildView(preOrder: PreOrder, menu: Map<string, number>): MyPreOrderView {
  let totalCents = 0

  const lines: MyPreOrderLine[] = preOrder.products.map((product) => {
    const quantity = Number(product.$extras.pivot_quantity)
    const unitPrice = menu.get(`${preOrder.eventId}:${product.id}`) ?? 0
    totalCents += unitPrice * quantity

    return {
      productId: product.id,
      productName: product.name,
      quantity,
      receivedQuantity: Number(product.$extras.pivot_received_quantity),
      unitPrice,
    }
  })

  lines.sort((a, b) => a.productName.localeCompare(b.productName, 'fr'))

  const createdAt = preOrder.createdAt?.toISO() ?? null

  return {
    id: preOrder.id,
    reference: referenceOf(preOrder.id, createdAt),
    eventId: preOrder.eventId,
    eventName: preOrder.event?.name ?? `Soirée #${preOrder.eventId}`,
    eventDate: preOrder.event?.date?.toISO() ?? null,
    status: preOrder.status,
    lines,
    totalCents,
    paid: preOrder.transactionId !== null && preOrder.transactionId !== undefined,
    fullyCollected: lines.length > 0 && lines.every((l) => l.receivedQuantity >= l.quantity),
    pickupAt: preOrder.pickupAt?.toISO() ?? null,
    createdAt,
  }
}

export async function listPreOrders(userId: number): Promise<MyPreOrderView[]> {
  const preOrders = await PreOrder.query()
    .where('userId', userId)
    .preload('event')
    .preload('products')
    .orderBy('id', 'desc')

  const menu = await menusOf([...new Set(preOrders.map((preOrder) => preOrder.eventId))])

  return preOrders.map((preOrder) => buildView(preOrder, menu))
}

export async function findPreOrder(userId: number, preOrderId: number): Promise<MyPreOrderView> {
  const preOrder = await PreOrder.query()
    .where('id', preOrderId)
    .where('userId', userId)
    .preload('event')
    .preload('products')
    .first()

  if (!preOrder) {
    throw new ApiException('E_PRE_ORDER_NOT_FOUND', "Cette précommande n'existe pas.", 404)
  }

  return buildView(preOrder, await menusOf([preOrder.eventId]))
}

export const PRE_ORDER_QR_TTL_SECONDS = 180

export interface PreOrderQrView {
  token: string
  expiresAt: string
  ttlSeconds: number
}

export async function preOrderQr(userId: number, preOrderId: number): Promise<PreOrderQrView> {
  const preOrder = await PreOrder.query().where('id', preOrderId).where('userId', userId).first()

  if (!preOrder) {
    throw new ApiException('E_PRE_ORDER_NOT_FOUND', "Cette précommande n'existe pas.", 404)
  }

  if (preOrder.status === 'cancelled') {
    throw new ApiException(
      'E_PRE_ORDER_CANCELLED',
      'Cette précommande est annulée : aucun QR de retrait ne peut être émis.',
      409
    )
  }

  const token = await new JwtService().generateQrToken(
    {
      type: 'pre_order',
      userId,
      preOrderId: preOrder.id,
      eventId: preOrder.eventId,
    },
    PRE_ORDER_QR_TTL_SECONDS
  )

  return {
    token,
    expiresAt: DateTime.now().plus({ seconds: PRE_ORDER_QR_TTL_SECONDS }).toISO()!,
    ttlSeconds: PRE_ORDER_QR_TTL_SECONDS,
  }
}

export async function listSubscriptions(userId: number): Promise<SubscriptionView[]> {
  const subscriptions = await Subscription.query()
    .where('userId', userId)
    .preload('fastPass')
    .preload('transaction')

  return subscriptions.map(toView).sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))
}
