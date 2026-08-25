import type { HttpContext } from '@adonisjs/core/http'
import Transaction from '#models/transaction'

interface TransactionPayload {
  id: number
  type: string
  amount: number
  eventId: number | null
  orderIds: number[]
  createdAt: string | null
}

function toPayload(transaction: Transaction): TransactionPayload {
  const orders = transaction.orders ?? []
  const eventId = orders.find((order) => order.eventId !== null)?.eventId ?? null

  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    eventId,
    orderIds: orders.map((order) => order.id),
    createdAt: transaction.createdAt ? transaction.createdAt.toISO() : null,
  }
}

export default class TransactionsController {
  async index({ request, serialize }: HttpContext) {
    const rawEventId = request.qs().eventId
    const eventId = rawEventId === undefined || rawEventId === '' ? null : Number(rawEventId)

    const query = Transaction.query().preload('orders').orderBy('createdAt', 'desc')

    if (eventId !== null && !Number.isNaN(eventId)) {
      query.whereHas('orders', (ordersQuery) => ordersQuery.where('eventId', eventId))
    }

    const transactions = await query
    return serialize(transactions.map(toPayload))
  }
}
