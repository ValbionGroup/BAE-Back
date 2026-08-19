import { DateTime } from 'luxon'
import ApiException from '#exceptions/api_exception'
import Event from '#models/event'
import { fastPassOf } from '#services/buyer_service'
import {
  fastPassBonusPercent,
  preOrderCloseLeadHours,
  preOrderDiscountPercent,
} from '#services/public_catalog_service'

export interface QuoteLine {
  productId: number
  quantity: number
}

export interface PreOrderQuote {
  amountCents: number
  /** Ce qui reste avant la clôture, et qui borne la durée de vie de la demande. */
  secondsUntilClose: number
  /** Remonté d'ici pour le libellé du paiement : la soirée est déjà chargée. */
  eventName: string
}

/**
 * Le montant d'une précommande, **recalculé depuis le tarif de la soirée**.
 *
 * Rien de ce que le client envoie n'entre dans le prix : accepter un total,
 * c'est le lui laisser fixer. Seules la soirée et les quantités viennent de lui,
 * et les deux sont vérifiées ici.
 */
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
  for (const line of lines) {
    const price = prices.get(line.productId)
    if (price === undefined) {
      throw new ApiException(
        'E_PRODUCT_NOT_ON_MENU',
        "Un des articles n'est pas au menu de cette soirée.",
        422
      )
    }
    subtotal += price * line.quantity
  }

  // Le bonus s'ajoute à la remise, comme l'annonce la page Fastpass. La validité
  // de l'adhésion se lit par `fastPassOf` plutôt que réimplémentée : la règle
  // d'échéance n'a qu'un seul endroit où vivre.
  const bonus = (await fastPassOf(userId, now)) === null ? 0 : fastPassBonusPercent()
  const percent = preOrderDiscountPercent() + bonus

  return {
    amountCents: subtotal - Math.round((subtotal * percent) / 100),
    secondsUntilClose,
    eventName: event.name,
  }
}
