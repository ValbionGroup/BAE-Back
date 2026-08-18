import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import JwtService from '#services/jwt_service'
import PreOrder from '#models/pre_order'
import Subscription from '#models/subscription'
import ApiException from '#exceptions/api_exception'
import { toView, type SubscriptionView } from '#services/subscription_service'

/**
 * Ce qu'un compte voit de **ses propres** achats.
 *
 * ⚠️ Chaque requête d'ici porte un `where user_id`. C'est le seul contrôle
 * d'accès de ce module, et il n'y en aura pas d'autre : aucune permission ne
 * saurait dire « les siennes », exactement comme pour les notifications
 * (`start/routes/system.ts`). Retirer ce filtre ouvrirait l'historique d'achat
 * de toute l'école.
 */

export interface MyPreOrderLine {
  productId: number
  productName: string
  quantity: number
  /** Déjà remis — `pre_order_items.received_quantity` porte le retrait partiel. */
  receivedQuantity: number
  /** Prix unitaire relu du menu de la soirée, en centimes. */
  unitPrice: number
}

export interface MyPreOrderView {
  id: number
  /**
   * Repère lisible, **dérivé** et non stocké : `BAE-<année>-<id sur 4>`. Aucune
   * colonne ne le porte, et en inventer une qui doublerait `id` et `created_at`
   * ouvrirait la porte à ce qu'ils divergent.
   */
  reference: string
  eventId: number
  eventName: string
  /** ISO 8601, le début de la soirée. */
  eventDate: string | null
  status: string
  lines: MyPreOrderLine[]
  totalCents: number
  /** `transactions` reste vide tant qu'aucun paiement n'est branché. */
  paid: boolean
  fullyCollected: boolean
  pickupAt: string | null
  createdAt: string | null
}

function referenceOf(id: number, createdAt: string | null): string {
  const year = createdAt === null ? new Date().getFullYear() : new Date(createdAt).getFullYear()
  return `BAE-${year}-${String(id).padStart(4, '0')}`
}

/** Prix unitaires du menu, par soirée. Les précommandes s'étalent sur plusieurs. */
async function menusOf(eventIds: number[]): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map()

  const rows = await db
    .from('event_products')
    .whereIn('event_id', eventIds)
    .select('event_id', 'product_id', 'price')

  return new Map(rows.map((row) => [`${row.event_id}:${row.product_id}`, Number(row.price)]))
}

function buildView(preOrder: PreOrder, menu: Map<string, number>): MyPreOrderView {
  let totalCents = 0

  const lines: MyPreOrderLine[] = preOrder.products.map((product) => {
    const quantity = Number(product.$extras.pivot_quantity)
    const unitPrice = menu.get(`${preOrder.eventId}:${product.id}`) ?? 0
    totalCents += unitPrice * quantity

    return {
      productId: product.id,
      productName: product.name,
      quantity,
      receivedQuantity: Number(product.$extras.pivot_received_quantity),
      unitPrice,
    }
  })

  lines.sort((a, b) => a.productName.localeCompare(b.productName, 'fr'))

  const createdAt = preOrder.createdAt?.toISO() ?? null

  return {
    id: preOrder.id,
    reference: referenceOf(preOrder.id, createdAt),
    eventId: preOrder.eventId,
    eventName: preOrder.event?.name ?? `Soirée #${preOrder.eventId}`,
    eventDate: preOrder.event?.date?.toISO() ?? null,
    status: preOrder.status,
    lines,
    totalCents,
    paid: preOrder.transactionId !== null && preOrder.transactionId !== undefined,
    fullyCollected: lines.length > 0 && lines.every((l) => l.receivedQuantity >= l.quantity),
    pickupAt: preOrder.pickupAt?.toISO() ?? null,
    createdAt,
  }
}

/** Les précommandes d'un compte, la plus récente en tête. */
export async function listPreOrders(userId: number): Promise<MyPreOrderView[]> {
  const preOrders = await PreOrder.query()
    .where('userId', userId)
    .preload('event')
    .preload('products')
    .orderBy('id', 'desc')

  const menu = await menusOf([...new Set(preOrders.map((preOrder) => preOrder.eventId))])

  return preOrders.map((preOrder) => buildView(preOrder, menu))
}

/**
 * Une précommande précise.
 *
 * ⚠️ Le `where user_id` est dans la **requête**, pas dans un test après coup :
 * charger d'abord puis comparer laisserait un 404 et un 403 se distinguer, et
 * cette différence dit à un curieux qu'une précommande existe.
 */
export async function findPreOrder(userId: number, preOrderId: number): Promise<MyPreOrderView> {
  const preOrder = await PreOrder.query()
    .where('id', preOrderId)
    .where('userId', userId)
    .preload('event')
    .preload('products')
    .first()

  if (!preOrder) {
    throw new ApiException('E_PRE_ORDER_NOT_FOUND', "Cette précommande n'existe pas.", 404)
  }

  return buildView(preOrder, await menusOf([preOrder.eventId]))
}

/**
 * Durée de vie du QR de retrait, alignée sur celle du QR d'identité
 * (`QrsController.mine`) : trois minutes gardent l'essentiel de la protection —
 * le temps d'envoyer une capture d'écran à quelqu'un, elle ne vaut plus rien —
 * tout en laissant le temps d'atteindre le comptoir dans une salle bondée.
 */
export const PRE_ORDER_QR_TTL_SECONDS = 180

export interface PreOrderQrView {
  token: string
  /** ISO 8601 : la carte se renouvelle un peu avant. */
  expiresAt: string
  ttlSeconds: number
}

/**
 * Le QR **de retrait** d'une précommande — le seul émetteur de jetons
 * `pre_order` de l'application.
 *
 * Le type existait déjà dans `QrTokenPayload` et `POST /v1/qr/verify` savait
 * le lire, mais rien ne le produisait : le comptoir attendait un jeton que
 * personne n'émettait.
 *
 * ⚠️ Le jeton porte `userId` **et** `preOrderId`, et `pickupFor()` refuse la
 * paire incohérente. Signer la seule précommande laisserait un jeton volé
 * ouvrir la commande d'autrui.
 */
export async function preOrderQr(userId: number, preOrderId: number): Promise<PreOrderQrView> {
  const preOrder = await PreOrder.query().where('id', preOrderId).where('userId', userId).first()

  if (!preOrder) {
    throw new ApiException('E_PRE_ORDER_NOT_FOUND', "Cette précommande n'existe pas.", 404)
  }

  // Un QR pour une commande annulée se présenterait au stand et n'ouvrirait
  // rien : mieux vaut le refuser ici, avec un motif, que dans la file d'attente.
  if (preOrder.status === 'cancelled') {
    throw new ApiException(
      'E_PRE_ORDER_CANCELLED',
      'Cette précommande est annulée : aucun QR de retrait ne peut être émis.',
      409
    )
  }

  const token = await new JwtService().generateQrToken(
    {
      type: 'pre_order',
      userId,
      preOrderId: preOrder.id,
      eventId: preOrder.eventId,
    },
    PRE_ORDER_QR_TTL_SECONDS
  )

  return {
    token,
    expiresAt: DateTime.now().plus({ seconds: PRE_ORDER_QR_TTL_SECONDS }).toISO()!,
    ttlSeconds: PRE_ORDER_QR_TTL_SECONDS,
  }
}

/**
 * Les cotisations d'un compte — c'est-à-dire ses souscriptions à une formule.
 *
 * `fast_passes` **est** la table des cotisations : `SubscriptionsController`
 * parle d'« adhérent » et de « cotisation » pour ces mêmes lignes. Il n'existe
 * pas d'adhésion séparée à laquelle un pass s'ajouterait.
 */
export async function listSubscriptions(userId: number): Promise<SubscriptionView[]> {
  const subscriptions = await Subscription.query()
    .where('userId', userId)
    .preload('fastPass')
    .preload('transaction')

  return subscriptions.map(toView).sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))
}
