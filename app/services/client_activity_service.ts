import db from '@adonisjs/lucid/services/db'
import { applyDiscount } from '#services/pre_order_quote_service'

export interface ClientActivity {
  preOrderCount: number
  spentCents: number
}

export async function activityOf(userId: number): Promise<ClientActivity> {
  const counter = await db
    .from('order_products')
    .join('orders', 'orders.id', 'order_products.order_id')
    .where('orders.client_id', userId)
    .whereNot('orders.status', 'cancelled')
    .sum({ cashed: db.raw('order_products.unit_price_cents * order_products.quantity') })
    .first()

  const preOrderRows = await db
    .from('pre_order_items')
    .join('pre_orders', 'pre_orders.id', 'pre_order_items.pre_order_id')
    .where('pre_orders.user_id', userId)
    .whereNot('pre_orders.status', 'cancelled')
    .whereNotNull('pre_orders.transaction_id')
    .groupBy('pre_orders.id', 'pre_orders.discount_percent')
    .select('pre_orders.discount_percent')
    .sum({ subtotal: db.raw('pre_order_items.list_price_cents * pre_order_items.quantity') })

  const preOrderCents = preOrderRows.reduce(
    (total, row) => total + applyDiscount(Number(row.subtotal ?? 0), Number(row.discount_percent)),
    0
  )

  const counted = await db
    .from('pre_orders')
    .where('user_id', userId)
    .whereNot('status', 'cancelled')
    .count('* as total')
    .first()

  return {
    preOrderCount: Number(counted?.total ?? 0),
    spentCents: Number(counter?.cashed ?? 0) + preOrderCents,
  }
}
