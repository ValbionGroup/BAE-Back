import type { HttpContext } from '@adonisjs/core/http'
import Transaction from '#models/transaction'
import type Order from '#models/order'
import type PreOrder from '#models/pre_order'

type Nature = 'order' | 'pre_order' | 'subscription' | 'other'

interface TransactionPayload {
  id: number
  type: string
  amount: number
  eventId: number | null
  orderIds: number[]
  nature: Nature
  label: string | null
  itemCount: number
  payer: string | null
  createdAt: string | null
}

/** Les quantités vivent dans le pivot (`order_products`, `pre_order_items`). */
function countItems(carriers: readonly (Order | PreOrder)[]): number {
  return carriers.reduce(
    (total, carrier) =>
      total +
      (carrier.products ?? []).reduce(
        (sum, product) => sum + Number(product.$extras.pivot_quantity ?? 0),
        0
      ),
    0
  )
}

/** Le premier produit, et le nombre de suivants — la ligne n'a pas la place du reste. */
function summariseProducts(carriers: readonly (Order | PreOrder)[]): string | null {
  const names = carriers.flatMap((carrier) => (carrier.products ?? []).map((p) => p.name))
  if (names.length === 0) return null
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
}

function toPayload(transaction: Transaction): TransactionPayload {
  const orders = transaction.orders ?? []
  const preOrders = transaction.preOrder ?? []
  const subscriptions = transaction.subscriptions ?? []

  const base = {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    eventId:
      orders.find((order) => order.eventId !== null)?.eventId ?? preOrders[0]?.eventId ?? null,
    orderIds: orders.map((order) => order.id),
    createdAt: transaction.createdAt ? transaction.createdAt.toISO() : null,
  }

  if (orders.length > 0) {
    const order = orders[0]
    return {
      ...base,
      nature: 'order',
      label: order.event?.name ?? null,
      itemCount: countItems(orders),
      payer: order.payerName ?? order.client?.fullName ?? null,
    }
  }

  if (preOrders.length > 0) {
    return {
      ...base,
      nature: 'pre_order',
      label: summariseProducts(preOrders),
      itemCount: countItems(preOrders),
      payer: preOrders[0].user?.fullName ?? null,
    }
  }

  if (subscriptions.length > 0) {
    const subscription = subscriptions[0]
    return {
      ...base,
      nature: 'subscription',
      label: subscription.fastPass?.label ?? null,
      itemCount: 0,
      payer: subscription.user?.fullName ?? null,
    }
  }

  return { ...base, nature: 'other', label: null, itemCount: 0, payer: null }
}

export default class TransactionsController {
  async index({ request, serialize }: HttpContext) {
    const rawEventId = request.qs().eventId
    const eventId = rawEventId === undefined || rawEventId === '' ? null : Number(rawEventId)

    const query = Transaction.query()
      .preload('orders', (orders) => orders.preload('event').preload('client').preload('products'))
      .preload('preOrder', (preOrders) => preOrders.preload('user').preload('products'))
      .preload('subscriptions', (subscriptions) =>
        subscriptions.preload('user').preload('fastPass')
      )
      .orderBy('createdAt', 'desc')

    // Une précommande n'a pas d'`Order` : la filtrer sur `orders` seul la ferait
    // disparaître du registre dès qu'une soirée est active.
    if (eventId !== null && !Number.isNaN(eventId)) {
      query.where((scoped) => {
        scoped
          .whereHas('orders', (orders) => orders.where('eventId', eventId))
          .orWhereHas('preOrder', (preOrders) => preOrders.where('eventId', eventId))
      })
    }

    const transactions = await query
    return serialize(transactions.map(toPayload))
  }
}
