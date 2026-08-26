import db from '@adonisjs/lucid/services/db'
import { sellableForEvent } from '#services/order_service'

export interface SummaryLine {
  productId: number
  productName: string
  plannedQty: number
  producedQty: number
  soldQty: number
  unitPriceCents: number
  revenueCents: number
  cashedCents: number
  /** L'écart total consenti : `receivableCents + grantedCents`. */
  sponsoredCents: number
  /** Part réclamée à un tiers payeur (catégories externes). */
  receivableCents: number
  /** Part offerte par le BAE (catégories internes) — jamais recouvrée. */
  grantedCents: number
  unsoldQty: number
}

export interface EventSummary {
  eventId: number
  orderCount: number
  cancelledCount: number
  /** Brut au prix public. Ne bouge pas : un bilan déjà imprimé reste relisible. */
  revenueCents: number
  /** `revenueCents` moins ce que le BAE a offert — ce qu'il peut encore toucher. */
  netRevenueCents: number
  cashedCents: number
  sponsoredCents: number
  receivableCents: number
  grantedCents: number
  payerName: string | null
  receivableByCategory: { label: string; dueCents: number }[]
  /** Symétrique du précédent, côté offert. */
  grantedByCategory: { label: string; grantedCents: number }[]
  /** `amount` en **centimes**, comme `revenueCents` et `cashedCents`. */
  cashedByMethod: { method: string; amount: number; count: number }[]
  lines: SummaryLine[]
}

export async function summaryForEvent(eventId: number): Promise<EventSummary> {
  const lines = await sellableForEvent(eventId)

  // `leftJoin` et non `join` : la vaste majorité des commandes n'a aucune
  // catégorie, et une jointure stricte les ferait toutes disparaître du bilan.
  const soldRows = await db
    .from('order_products')
    .join('orders', 'orders.id', 'order_products.order_id')
    .leftJoin(
      'sponsorship_categories',
      'sponsorship_categories.id',
      'orders.sponsorship_category_id'
    )
    .where('orders.event_id', eventId)
    .whereNot('orders.status', 'cancelled')
    .groupBy('order_products.product_id')
    .select('order_products.product_id')
    .sum({
      gross: db.raw('order_products.list_price_cents * order_products.quantity'),
      cashed: db.raw('order_products.unit_price_cents * order_products.quantity'),
      receivable: db.raw(
        "CASE WHEN sponsorship_categories.mode = 'external' THEN (order_products.list_price_cents - order_products.unit_price_cents) * order_products.quantity ELSE 0 END"
      ),
      granted: db.raw(
        "CASE WHEN sponsorship_categories.mode = 'internal' THEN (order_products.list_price_cents - order_products.unit_price_cents) * order_products.quantity ELSE 0 END"
      ),
    })

  const soldBy = new Map(
    soldRows.map((row) => [
      Number(row.product_id),
      {
        gross: Number(row.gross ?? 0),
        cashed: Number(row.cashed ?? 0),
        receivable: Number(row.receivable ?? 0),
        granted: Number(row.granted ?? 0),
      },
    ])
  )

  const priceRows = await db
    .from('event_products')
    .where('event_id', eventId)
    .select('product_id', 'price')

  const priceBy = new Map(priceRows.map((row) => [Number(row.product_id), Number(row.price)]))

  const summaryLines: SummaryLine[] = lines.map((line) => {
    const sold = soldBy.get(line.productId) ?? { gross: 0, cashed: 0, receivable: 0, granted: 0 }
    return {
      productId: line.productId,
      productName: line.productName,
      plannedQty: line.plannedQty,
      producedQty: line.producedQty,
      soldQty: line.soldQty,
      unitPriceCents: priceBy.get(line.productId) ?? 0,
      revenueCents: sold.gross,
      cashedCents: sold.cashed,
      sponsoredCents: sold.receivable + sold.granted,
      receivableCents: sold.receivable,
      grantedCents: sold.granted,
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
    // ⚠️ `Number()` n'est pas décoratif : le pilote rend une colonne numérique en
    // **chaîne**, et `0 + '8.50'` vaut `'08.50'`. Le total par moyen de paiement
    // se construisait donc par concaténation — « 08.508.0019.0043.00… » servi
    // tel quel au bilan. Toutes les autres sommes de ce fichier convertissent ;
    // celle-ci avait été oubliée.
    entry.amount += Number(row.amount)
    entry.count += 1
    byMethod.set(method, entry)
  }

  // Groupé par libellé **et** par mode : le libellé est la copie figée sur la
  // commande, le mode vient de la catégorie vivante — et le verrou de bascule
  // garantit qu'il n'a pas pu changer depuis la vente.
  const consentedRows = await db
    .from('order_products')
    .join('orders', 'orders.id', 'order_products.order_id')
    .join('sponsorship_categories', 'sponsorship_categories.id', 'orders.sponsorship_category_id')
    .where('orders.event_id', eventId)
    .whereNot('orders.status', 'cancelled')
    .groupBy('orders.sponsorship_category_label', 'sponsorship_categories.mode')
    .select('orders.sponsorship_category_label', 'sponsorship_categories.mode')
    .sum({
      due: db.raw(
        '(order_products.list_price_cents - order_products.unit_price_cents) * order_products.quantity'
      ),
    })

  const event = await db.from('events').where('id', eventId).select('payer_name').first()

  const total = (pick: (line: SummaryLine) => number) =>
    summaryLines.reduce((sum, line) => sum + pick(line), 0)

  const revenueCents = total((line) => line.revenueCents)
  const grantedCents = total((line) => line.grantedCents)

  return {
    eventId,
    orderCount,
    cancelledCount,
    revenueCents,
    // Le brut moins ce qui a été offert : ce que le BAE peut encore toucher, une
    // fois le tiers payeur passé à la caisse.
    netRevenueCents: revenueCents - grantedCents,
    cashedCents: total((line) => line.cashedCents),
    sponsoredCents: total((line) => line.sponsoredCents),
    receivableCents: total((line) => line.receivableCents),
    grantedCents,
    payerName: event?.payer_name ?? null,
    receivableByCategory: consentedRows
      .filter((row) => row.mode === 'external')
      .map((row) => ({
        label: String(row.sponsorship_category_label),
        dueCents: Number(row.due ?? 0),
      })),
    grantedByCategory: consentedRows
      .filter((row) => row.mode === 'internal')
      .map((row) => ({
        label: String(row.sponsorship_category_label),
        grantedCents: Number(row.due ?? 0),
      })),
    cashedByMethod: [...byMethod.entries()].map(([method, totals]) => ({ method, ...totals })),
    lines: summaryLines,
  }
}
