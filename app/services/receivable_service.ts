import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import ApiException from '#exceptions/api_exception'

export interface ReceivableLine {
  productName: string
  quantity: number
  listPriceCents: number
  paidPriceCents: number
  dueCents: number
}

export interface ReceivableCategory {
  label: string
  lines: ReceivableLine[]
  dueCents: number
}

export interface ReceivableStatement {
  eventId: number
  eventName: string
  payerName: string | null
  categories: ReceivableCategory[]
  dueCents: number
}

/**
 * Le justificatif de recouvrement : ce que le tiers payeur doit au BAE.
 *
 * ⚠️ **Externe seulement.** Les catégories internes sont offertes par le BAE et
 * n'apparaissent pas ici — elles se lisent en manque à gagner dans le bilan
 * (`event_summary_service`, `grantedCents`), jamais en créance.
 *
 * Les lignes sont groupées par catégorie **et par couple de prix** : une grille
 * modifiée en cours de soirée fait coexister deux prix payés pour le même
 * article, et les fondre en une moyenne donnerait un document faux.
 */
export async function receivablesForEvent(eventId: number): Promise<ReceivableStatement> {
  const event = await Event.find(eventId)
  if (!event) {
    throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
  }

  const rows = await db
    .from('order_products')
    .join('orders', 'orders.id', 'order_products.order_id')
    .join('products', 'products.id', 'order_products.product_id')
    .join('sponsorship_categories', 'sponsorship_categories.id', 'orders.sponsorship_category_id')
    .where('orders.event_id', eventId)
    .whereNot('orders.status', 'cancelled')
    .whereNotNull('orders.sponsorship_category_id')
    // Seul l'externe se réclame : une catégorie interne est offerte par le BAE,
    // elle n'a pas de destinataire à qui présenter la note.
    .where('sponsorship_categories.mode', 'external')
    .groupBy(
      'orders.sponsorship_category_label',
      'products.name',
      'order_products.list_price_cents',
      'order_products.unit_price_cents'
    )
    .orderBy('orders.sponsorship_category_label', 'asc')
    .orderBy('products.name', 'asc')
    .select(
      'orders.sponsorship_category_label as label',
      'products.name as product_name',
      'order_products.list_price_cents',
      'order_products.unit_price_cents'
    )
    .sum({ quantity: 'order_products.quantity' })

  const byCategory = new Map<string, ReceivableCategory>()

  for (const row of rows) {
    const label = String(row.label)
    const quantity = Number(row.quantity)
    const listPriceCents = Number(row.list_price_cents)
    const paidPriceCents = Number(row.unit_price_cents)

    const category = byCategory.get(label) ?? { label, lines: [], dueCents: 0 }
    const dueCents = (listPriceCents - paidPriceCents) * quantity

    // Les lignes sans écart sont conservées : le trésorier d'en face doit
    // reconstituer le panier réel et voir que rien n'est dû dessus.
    category.lines.push({
      productName: String(row.product_name),
      quantity,
      listPriceCents,
      paidPriceCents,
      dueCents,
    })
    category.dueCents += dueCents
    byCategory.set(label, category)
  }

  const categories = [...byCategory.values()]

  return {
    eventId,
    eventName: event.name,
    payerName: event.payerName,
    categories,
    dueCents: categories.reduce((total, category) => total + category.dueCents, 0),
  }
}
