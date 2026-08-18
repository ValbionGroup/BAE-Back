import db from '@adonisjs/lucid/services/db'
import { sellableForEvent } from '#services/order_service'

export interface SummaryLine {
  productId: number
  productName: string
  plannedQty: number
  producedQty: number
  soldQty: number
  /** ⚠️ En **centimes**, comme `event_products.price`. Le front convertit. */
  unitPriceCents: number
  /** Valeur au prix public. */
  revenueCents: number
  /** Ce que le comptoir a réellement encaissé sur cette ligne. */
  cashedCents: number
  /** Écart pris en charge par un tiers, à recouvrer. */
  sponsoredCents: number
  /** Produit et non vendu. Ce qui reste sur les bras, pas ce qui manque. */
  unsoldQty: number
}

export interface EventSummary {
  eventId: number
  orderCount: number
  cancelledCount: number
  /** Valeur au prix public : `cashedCents + sponsoredCents`. */
  revenueCents: number
  cashedCents: number
  sponsoredCents: number
  payerName: string | null
  receivableByCategory: { label: string; dueCents: number }[]
  /** Encaissé réellement, par moyen. En **euros** — c'est l'unité de `transactions`. */
  cashedByMethod: { method: string; amount: number; count: number }[]
  lines: SummaryLine[]
}

/**
 * Le bilan d'une soirée, calculé côté serveur.
 *
 * ⚠️ Deux montants coexistent et **ne sont pas censés être égaux** :
 * `revenueCents` est ce que les commandes valaient (prix du menu × quantités),
 * `cashedByMethod` ce que les transactions ont réellement encaissé. Un écart est
 * une information — remise, précommande payée un autre jour, commande annulée
 * après paiement — pas une erreur à masquer en n'en affichant qu'un seul.
 */
export async function summaryForEvent(eventId: number): Promise<EventSummary> {
  const lines = await sellableForEvent(eventId)

  // Les prix viennent des lignes vendues, jamais du menu courant : celui-ci peut
  // avoir changé depuis, et le bilan d'une soirée passée doit rester stable.
  const soldRows = await db
    .from('order_products')
    .join('orders', 'orders.id', 'order_products.order_id')
    .where('orders.event_id', eventId)
    .whereNot('orders.status', 'cancelled')
    .groupBy('order_products.product_id')
    .select('order_products.product_id')
    .sum({
      gross: db.raw('order_products.list_price_cents * order_products.quantity'),
      cashed: db.raw('order_products.unit_price_cents * order_products.quantity'),
      sponsored: db.raw(
        'CASE WHEN orders.sponsorship_category_id IS NULL THEN 0 ELSE (order_products.list_price_cents - order_products.unit_price_cents) * order_products.quantity END'
      ),
    })

  const soldBy = new Map(
    soldRows.map((row) => [
      Number(row.product_id),
      {
        gross: Number(row.gross ?? 0),
        cashed: Number(row.cashed ?? 0),
        sponsored: Number(row.sponsored ?? 0),
      },
    ])
  )

  const priceRows = await db
    .from('event_products')
    .where('event_id', eventId)
    .select('product_id', 'price')

  const priceBy = new Map(priceRows.map((row) => [Number(row.product_id), Number(row.price)]))

  const summaryLines: SummaryLine[] = lines.map((line) => {
    const sold = soldBy.get(line.productId) ?? { gross: 0, cashed: 0, sponsored: 0 }
    return {
      productId: line.productId,
      productName: line.productName,
      plannedQty: line.plannedQty,
      producedQty: line.producedQty,
      soldQty: line.soldQty,
      unitPriceCents: priceBy.get(line.productId) ?? 0,
      revenueCents: sold.gross,
      cashedCents: sold.cashed,
      sponsoredCents: sold.sponsored,
      unsoldQty: Math.max(0, line.producedQty - line.soldQty),
    }
  })

  const statusCounts = await db
    .from('orders')
    .where('event_id', eventId)
    .groupBy('status')
    .select('status')
    .count('* as total')

  let orderCount = 0
  let cancelledCount = 0
  for (const row of statusCounts) {
    const total = Number(row.total)
    if (row.status === 'cancelled') cancelledCount += total
    else orderCount += total
  }

  // `transactions` n'a pas d'`event_id` : le rattachement passe par
  // `orders.transaction_id`. Une transaction peut régler plusieurs commandes,
  // d'où le `countDistinct` — la compter par commande la multiplierait.
  const cashedRows = await db
    .from('transactions')
    .join('orders', 'orders.transaction_id', 'transactions.id')
    .where('orders.event_id', eventId)
    .groupBy('transactions.type', 'transactions.id', 'transactions.amount')
    .select('transactions.type', 'transactions.id', 'transactions.amount')

  const byMethod = new Map<string, { amount: number; count: number }>()
  for (const row of cashedRows) {
    const method = String(row.type)
    const entry = byMethod.get(method) ?? { amount: 0, count: 0 }
    // ⚠️ `decimal` revient en **string** du driver : convertir explicitement,
    // sinon l'addition concatène silencieusement.
    entry.amount += Number(row.amount)
    entry.count += 1
    byMethod.set(method, entry)
  }

  const receivableRows = await db
    .from('order_products')
    .join('orders', 'orders.id', 'order_products.order_id')
    .where('orders.event_id', eventId)
    .whereNot('orders.status', 'cancelled')
    .whereNotNull('orders.sponsorship_category_id')
    .groupBy('orders.sponsorship_category_label')
    .select('orders.sponsorship_category_label')
    .sum({
      due: db.raw(
        '(order_products.list_price_cents - order_products.unit_price_cents) * order_products.quantity'
      ),
    })

  const event = await db.from('events').where('id', eventId).select('payer_name').first()

  return {
    eventId,
    orderCount,
    cancelledCount,
    revenueCents: summaryLines.reduce((total, line) => total + line.revenueCents, 0),
    cashedCents: summaryLines.reduce((total, line) => total + line.cashedCents, 0),
    sponsoredCents: summaryLines.reduce((total, line) => total + line.sponsoredCents, 0),
    payerName: event?.payer_name ?? null,
    receivableByCategory: receivableRows.map((row) => ({
      label: String(row.sponsorship_category_label),
      dueCents: Number(row.due ?? 0),
    })),
    cashedByMethod: [...byMethod.entries()].map(([method, totals]) => ({ method, ...totals })),
    lines: summaryLines,
  }
}
