import type { HttpContext } from '@adonisjs/core/http'
import Transaction from '#models/transaction'

/**
 * Shape returned to the frontend for one encaissement.
 *
 * `amount` is a `decimal(10,2)` column, handed back as a string by `pg` and
 * therefore typed `string` on `TransactionSchema`. It is coerced to a number
 * here so the "encaissements" tile can sum without parsing.
 *
 * A transaction has no direct link to an event: `orders.transaction_id` points
 * back at it, and the order carries `event_id`. `eventId` below is that link,
 * flattened from the first attached order (a transaction settles a single
 * order in practice); `orderIds` keeps the full list for the rare fan-out.
 */
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
    amount: Number(transaction.amount),
    eventId,
    orderIds: orders.map((order) => order.id),
    createdAt: transaction.createdAt ? transaction.createdAt.toISO() : null,
  }
}

export default class TransactionsController {
  /**
   * Display a list of resource, most recent first.
   *
   * Read-only: the caisse write path is out of scope for this pass.
   *
   * Optional query string:
   * - `event_id` — keep only transactions settling an order of that event.
   *   (case_converter_middleware turns `event_id` into `eventId` first.)
   */
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
