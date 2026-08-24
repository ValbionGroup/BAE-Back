import { DateTime } from 'luxon'
import ApiException from '#exceptions/api_exception'
import Event from '#models/event'
import { fastPassOf } from '#services/buyer_service'
import {
  fastPassBonusPercent,
  preOrderCloseLeadHours,
  preOrderDiscountPercent,
} from '#services/public_catalog_service'

/**
 * Plafond par produit, repris de `createAccountPreOrderValidator` : une
 * précommande est un repas, pas une commande de gros.
 */
export const MAX_LINE_QUANTITY = 50

export interface QuoteLine {
  productId: number
  quantity: number
}

export interface PricedQuoteLine extends QuoteLine {
  listPriceCents: number
}

export interface PreOrderQuote {
  amountCents: number
  secondsUntilClose: number
  eventName: string
  lines: PricedQuoteLine[]
  discountPercent: number
}

export async function quotePreOrder(
  userId: number,
  eventId: number,
  lines: readonly QuoteLine[],
  now: DateTime = DateTime.now()
): Promise<PreOrderQuote> {
  const event = await Event.query().where('id', eventId).preload('products').first()

  if (!event) {
    throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
  }

  const closesAt = event.date.minus({ hours: preOrderCloseLeadHours(event) })
  const secondsUntilClose = Math.floor(closesAt.diff(now, 'seconds').seconds)

  if (secondsUntilClose <= 0) {
    throw new ApiException(
      'E_PRE_ORDERS_CLOSED',
      'Les précommandes de cette soirée sont fermées.',
      422
    )
  }

  const prices = new Map(
    event.products.map((product) => [product.id, Number(product.$extras.pivot_price)])
  )

  let subtotal = 0
  const priced: PricedQuoteLine[] = []

  for (const line of mergeQuoteLines(lines)) {
    const price = prices.get(line.productId)
    if (price === undefined) {
      throw new ApiException(
        'E_PRODUCT_NOT_ON_MENU',
        "Un des articles n'est pas au menu de cette soirée.",
        422
      )
    }
    subtotal += price * line.quantity
    priced.push({ productId: line.productId, quantity: line.quantity, listPriceCents: price })
  }

  const bonus = (await fastPassOf(userId, now)) === null ? 0 : fastPassBonusPercent()
  const percent = preOrderDiscountPercent() + bonus

  return {
    amountCents: applyDiscount(subtotal, percent),
    secondsUntilClose,
    eventName: event.name,
    lines: priced,
    discountPercent: percent,
  }
}

/**
 * Fusionne les lignes portant le même produit.
 *
 * ⚠️ Sans cette fusion, deux lignes du même produit dans une même commande font
 * **échouer l'insert de `pre_order_items` après encaissement** : sa clé primaire
 * est `(pre_order_id, product_id)`. Le client est débité, la précommande
 * n'existe pas. Le total, lui, est le même dans les deux cas.
 *
 * Le plafond par ligne est re-testé **après** fusion : sinon deux lignes de 50
 * le contournent, et c'est précisément la forme d'entrée qu'on accepte ici.
 */
function mergeQuoteLines(lines: readonly QuoteLine[]): QuoteLine[] {
  const merged = new Map<number, number>()

  for (const line of lines) {
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity)
  }

  return [...merged].map(([productId, quantity]) => {
    if (quantity > MAX_LINE_QUANTITY) {
      throw new ApiException(
        'E_PRE_ORDER_QUANTITY_TOO_HIGH',
        `Un même article ne peut pas dépasser ${MAX_LINE_QUANTITY} unités par précommande.`,
        422
      )
    }
    return { productId, quantity }
  })
}

export function applyDiscount(subtotalCents: number, percent: number): number {
  return subtotalCents - Math.round((subtotalCents * percent) / 100)
}
