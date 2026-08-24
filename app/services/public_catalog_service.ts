import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import env from '#start/env'
import Event from '#models/event'
import FastPass from '#models/fast_pass'
import ApiException from '#exceptions/api_exception'
import { primaryCategoryName } from '#services/product_category_service'
import { pickupWindowOf } from '#services/pre_order_service'

/**
 * Le catalogue tel qu'un visiteur **non authentifié** le voit.
 *
 * Rien ici ne lit `auth` : c'est une page ouverte sur Internet, et ce service ne
 * doit exposer que ce qu'on accepte de publier. Toute donnée nominative (qui a
 * commandé, combien il a payé) vit dans `account_purchases`, pas ici.
 */

/**
 * Remise consentie pour inciter à précommander, en pourcentage du tarif public.
 *
 * ⚠️ Elle vit **côté serveur et nulle part ailleurs** : le jour où le paiement
 * existera, c'est le serveur qui arrêtera le montant à encaisser, comme
 * `order_service.checkout()` le fait déjà pour la caisse. Une seconde définition
 * côté front finirait par diverger, et l'écart se lirait en euros.
 */
export function preOrderDiscountPercent(): number {
  const configured = env.get('PRE_ORDER_DISCOUNT_PERCENT')
  if (configured === undefined) return 10

  // Une remise hors de [0, 100] est une faute de frappe de configuration, pas
  // une intention : mieux vaut la borner que facturer un montant négatif.
  return Math.min(100, Math.max(0, configured))
}

/**
 * Réduction **supplémentaire** accordée aux adhérents sur leurs précommandes.
 *
 * Elle s'ajoute à `preOrderDiscountPercent()`. Elle vit ici, et non écrite en
 * dur dans la page Fastpass, pour la même raison que l'autre : c'est le serveur
 * qui arrêtera le montant le jour où le paiement existera, et deux définitions
 * du même pourcentage finiraient par diverger.
 *
 * ⚠️ **Elle n'est encore appliquée nulle part** : la création de précommande
 * n'existe pas tant que Lydia n'est pas branché. Ce n'est aujourd'hui qu'une
 * promesse affichée — mais elle est déjà chiffrée au seul endroit qui comptera.
 */
export function fastPassBonusPercent(): number {
  const configured = env.get('FAST_PASS_PRE_ORDER_BONUS_PERCENT')
  if (configured === undefined) return 5

  return Math.min(100, Math.max(0, configured))
}

/**
 * Les précommandes ferment ce nombre d'heures avant le début de la soirée.
 *
 * Ce n'est pas un détail d'affichage : c'est le délai dont la cuisine dispose
 * pour produire ce qui a été commandé. Le raccourcir engage l'équipe à tenir un
 * volume qu'elle découvre trop tard.
 */
export function preOrderCloseLeadHours(event?: Event): number {
  // ⚠️ `null` sur la soirée n'est pas « zéro heure » mais « suivre le global » —
  // c'est ce qui permet de ne rien reprendre sur les soirées existantes.
  const configured = event?.preOrderCloseLeadHours ?? env.get('PRE_ORDER_CLOSE_LEAD_HOURS')
  if (configured === undefined || configured === null) return 12

  return Math.max(0, configured)
}

/** Une précommande annulée ne consomme aucune place. */
const COUNTED_STATUSES = ['pending', 'in_progress', 'ready', 'completed'] as const

export interface PublicEventView {
  id: number
  name: string
  description: string | null
  /** ISO 8601. */
  startsAt: string
  /**
   * Fin de la soirée, donc dernier créneau de retrait possible. Calculée ici
   * plutôt qu'exposée sous forme de durée : la colonne `events.duration` est en
   * secondes et nullable, deux pièges que le client n'a pas à connaître.
   */
  endsAt: string
  preOrdersCloseAt: string
  /** Nombre de précommandes acceptées. `0` ferme la soirée. */
  capacity: number
  placed: number
  remaining: number
  /** Il reste de la place **et** la clôture n'est pas passée. */
  open: boolean
}

// `number[]` et non `readonly number[]` : les types de Knex n'acceptent pas un
// tableau en lecture seule comme valeurs de `whereIn`, et la surcharge retenue
// devient alors celle qui attend une liste de colonnes — l'erreur parle d'un
// `string[]` sans jamais nommer le `readonly` qui l'a causée.
async function placedCounts(eventIds: number[]): Promise<Map<number, number>> {
  if (eventIds.length === 0) return new Map()

  const rows = await db
    .from('pre_orders')
    .whereIn('event_id', eventIds)
    .whereIn('status', [...COUNTED_STATUSES])
    .groupBy('event_id')
    .select('event_id')
    .count('* as total')

  return new Map(rows.map((row) => [Number(row.event_id), Number(row.total)]))
}

function toEventView(event: Event, placed: number, now: DateTime): PublicEventView {
  const closesAt = event.date.minus({ hours: preOrderCloseLeadHours(event) })
  const remaining = Math.max(0, event.capacity - placed)

  return {
    id: event.id,
    name: event.name,
    description: event.description,
    startsAt: event.date.toISO()!,
    endsAt: pickupWindowOf(event.date, event.duration).end.toISO()!,
    preOrdersCloseAt: closesAt.toISO()!,
    capacity: event.capacity,
    placed,
    remaining,
    open: event.capacity > 0 && remaining > 0 && now < closesAt,
  }
}

/**
 * Les soirées ouvertes à la précommande, la plus proche en tête.
 *
 * ⚠️ Le filtre porte sur `capacity > 0`, **pas** sur la date de clôture : une
 * soirée dont les précommandes viennent de fermer reste affichée, marquée
 * fermée. La retirer du catalogue le soir même donnerait l'impression qu'elle
 * n'a jamais existé, juste au moment où le plus de monde la cherche.
 */
export async function listOpenEvents(now: DateTime = DateTime.now()): Promise<PublicEventView[]> {
  const events = await Event.query()
    .where('capacity', '>', 0)
    .where('date', '>=', now.toSQL()!)
    .whereNot('status', 'completed')
    .orderBy('date', 'asc')

  const placed = await placedCounts(events.map((event) => event.id))

  return events.map((event) => toEventView(event, placed.get(event.id) ?? 0, now))
}

export interface PublicMenuLine {
  productId: number
  name: string
  description: string | null
  isVegetarian: boolean
  /** Tarif public, en **centimes** — l'unité de `event_products.price`. */
  price: number
  category: string | null
}

export interface PublicMenuView {
  event: PublicEventView
  discountPercent: number
  /** Le délai de clôture, pour que la page l'annonce sans le coder en dur. */
  closeLeadHours: number
  lines: PublicMenuLine[]
}

/**
 * Le menu d'une soirée ouverte à la précommande.
 *
 * ⚠️ Refuse une soirée à `capacity = 0` par un 404 et non par un menu vide :
 * publier la carte d'une soirée que personne n'a ouverte à la précommande
 * exposerait des prix qui ne sont pas encore arrêtés.
 */
export async function menuFor(
  eventId: number,
  now: DateTime = DateTime.now()
): Promise<PublicMenuView> {
  const event = await Event.query()
    .where('id', eventId)
    .where('capacity', '>', 0)
    .preload('products', (products) => {
      products.preload('goods', (goods) => goods.preload('category'))
      products.orderBy('name')
    })
    .first()

  if (!event) {
    throw new ApiException(
      'E_EVENT_NOT_FOUND',
      "Cette soirée n'est pas ouverte à la précommande.",
      404
    )
  }

  const placed = await placedCounts([event.id])

  return {
    event: toEventView(event, placed.get(event.id) ?? 0, now),
    discountPercent: preOrderDiscountPercent(),
    closeLeadHours: preOrderCloseLeadHours(event),
    lines: event.products.map((product) => ({
      productId: product.id,
      name: product.name,
      description: product.description,
      isVegetarian: product.isVegetarian ?? false,
      price: Number(product.$extras.pivot_price),
      category: primaryCategoryName(product),
    })),
  }
}

export interface PublicFastPassView {
  id: number
  label: string
  description: string | null
  /** Durée de l'adhésion en **années**, telle que stockée. */
  durationYears: number
  /**
   * En **centimes**, alors que `fast_passes.price` est un décimal en euros.
   *
   * La conversion a lieu ici pour que l'API n'ait qu'une seule unité monétaire :
   * `event_products.price` est déjà en centimes, et faire cohabiter les deux
   * dans les réponses obligerait chaque appelant à se souvenir laquelle il lit.
   */
  priceCents: number
}

export interface PublicFastPassCatalog {
  /** Réduction supplémentaire sur les précommandes, en pourcentage. */
  bonusPercent: number
  plans: PublicFastPassView[]
}

export async function listFastPasses(): Promise<PublicFastPassCatalog> {
  const passes = await FastPass.query().orderBy('duration', 'asc')

  const plans = passes.map((pass) => ({
    id: pass.id,
    label: pass.label,
    description: pass.description,
    durationYears: pass.duration,
    priceCents: Math.round(Number(pass.price) * 100),
  }))

  return { bonusPercent: fastPassBonusPercent(), plans }
}
