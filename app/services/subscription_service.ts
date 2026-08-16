import { DateTime } from 'luxon'
import type Subscription from '#models/subscription'

/**
 * Fenêtre « expire bientôt », alignée sur le bandeau de la page Adhérents
 * (« 41 expirations < 30j »). À ne pas confondre avec le seuil à 7 jours des
 * bons d'achat (`vouchers_controller`) : une cotisation se renouvelle sur un
 * rythme annuel, un bon d'achat se consomme dans la semaine.
 */
export const EXPIRY_WARN_WINDOW_DAYS = 30

export type SubscriptionStatus = 'active' | 'expired'

/** `none` : la personne est enregistrée mais n'a jamais cotisé. */
export type MembershipStatus = SubscriptionStatus | 'none'

export interface SubscriptionView {
  fastPassId: number
  label: string
  subscribedAt: string
  expiresAt: string
  status: SubscriptionStatus
  /** Montant réellement encaissé. `null` si aucun paiement n'est rattaché. */
  amount: number | null
  /** `cash` | `lydia`, tel que porté par la transaction. */
  paymentMethod: string | null
}

/**
 * ⚠️ `subscriptions.subscribed_at` étant une **clé primaire**, la génération de
 * schéma la déclare en `@column()` nu et non en `@column.dateTime()` : Lucid ne
 * la désérialise donc pas, et elle revient en `Date` du driver. Tout lecteur
 * doit passer par ici, sinon `.plus()` explose à l'exécution — pas au typecheck,
 * qui la croit Luxon.
 */
export function asDateTime(value: DateTime | Date | string): DateTime {
  if (value instanceof Date) return DateTime.fromJSDate(value)
  if (typeof value === 'string') return DateTime.fromISO(value)
  return value
}

export function expiryOf(subscribedAt: DateTime | Date | string, durationDays: number): DateTime {
  return asDateTime(subscribedAt).plus({ days: durationDays }).startOf('day')
}

export function daysUntil(expiresAt: DateTime): number {
  return Math.floor(expiresAt.diff(DateTime.now().startOf('day'), 'days').days)
}

export function statusOf(expiresAt: DateTime): SubscriptionStatus {
  return daysUntil(expiresAt) >= 0 ? 'active' : 'expired'
}

/**
 * ⚠️ Suppose `fastPass` préchargé, et `fast_passes.price` arrive en **string**
 * (colonne `decimal`) — d'où le `Number()`. Le montant vient de la transaction
 * quand il y en a une : le tarif de la formule, lui, change avec le temps, et
 * une cotisation payée 12 € en 2023 doit rester à 12 €.
 */
export function toView(subscription: Subscription): SubscriptionView {
  const expiresAt = expiryOf(subscription.subscribedAt, subscription.fastPass.duration)
  const transaction = subscription.transaction ?? null

  return {
    fastPassId: subscription.fastPassId,
    label: subscription.fastPass.label,
    subscribedAt: asDateTime(subscription.subscribedAt).toISODate()!,
    expiresAt: expiresAt.toISODate()!,
    status: statusOf(expiresAt),
    amount: transaction ? Number(transaction.amount) : null,
    paymentMethod: transaction ? transaction.type : null,
  }
}

/**
 * La cotisation courante est celle qui **expire le plus tard**, et non la plus
 * récemment souscrite : renouveler en avance crée une ligne plus récente dont
 * l'échéance est pourtant la bonne, et trier par `subscribedAt` afficherait
 * alors « expirée » à quelqu'un qui vient de payer.
 */
export function currentOf(views: readonly SubscriptionView[]): SubscriptionView | null {
  if (views.length === 0) return null
  return views.reduce((latest, view) => (view.expiresAt > latest.expiresAt ? view : latest))
}

/**
 * Numéro d'adhérent lisible, dérivé plutôt que stocké : une colonne de plus
 * n'apporterait rien qu'`id` et la date d'inscription ne disent déjà, et
 * pourrait diverger d'eux. `EXT` marque la personne qui n'a jamais cotisé —
 * c'est ce que la maquette distingue d'un adhérent expiré.
 */
export function membershipNumber(
  id: number,
  registeredAt: DateTime,
  everSubscribed: boolean
): string {
  const prefix = everSubscribed ? 'ADH' : 'EXT'
  return `${prefix}-${registeredAt.year}-${String(id).padStart(4, '0')}`
}
