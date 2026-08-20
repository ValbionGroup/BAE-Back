import db from '@adonisjs/lucid/services/db'
import { applyDiscount } from '#services/pre_order_quote_service'

export interface ClientActivity {
  preOrderCount: number
  /**
   * Ce que la personne a réellement payé, comptoir et précommandes confondus,
   * en **centimes**. Reprend la notion d'encaissé du bilan de soirée
   * (`unit_price_cents`, hors commandes annulées) plutôt qu'une variante.
   */
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

  // Le sous-total est agrégé en SQL, la remise appliquée en TypeScript :
  // `applyDiscount` est la seule définition de l'arrondi, et la répliquer ici en
  // SQL ferait diverger ce total du montant réellement encaissé.
  //
  // Seules les précommandes payées comptent : une précommande sans transaction
  // n'a rien coûté à personne.
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
