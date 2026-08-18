import { DateTime } from 'luxon'
import type Subscription from '#models/subscription'

export const EXPIRY_WARN_WINDOW_DAYS = 30

export type SubscriptionStatus = 'active' | 'expired'
export type MembershipStatus = SubscriptionStatus | 'none'

export interface SubscriptionView {
  fastPassId: number
  label: string
  subscribedAt: string
  expiresAt: string
  status: SubscriptionStatus
  amount: number | null
  paymentMethod: string | null
}

export function asDateTime(value: DateTime | Date | string): DateTime {
  if (value instanceof Date) return DateTime.fromJSDate(value)
  if (typeof value === 'string') return DateTime.fromISO(value)
  return value
}

export function expiryOf(subscribedAt: DateTime | Date | string, durationYears: number): DateTime {
  return asDateTime(subscribedAt).plus({ years: durationYears }).startOf('day')
}

export function daysUntil(expiresAt: DateTime): number {
  return Math.floor(expiresAt.diff(DateTime.now().startOf('day'), 'days').days)
}

export function statusOf(expiresAt: DateTime): SubscriptionStatus {
  return daysUntil(expiresAt) >= 0 ? 'active' : 'expired'
}

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

export function currentOf(views: readonly SubscriptionView[]): SubscriptionView | null {
  if (views.length === 0) return null
  return views.reduce((latest, view) => (view.expiresAt > latest.expiresAt ? view : latest))
}

export function membershipNumber(
  id: number,
  registeredAt: DateTime,
  everSubscribed: boolean
): string {
  const prefix = everSubscribed ? 'ADH' : 'EXT'
  return `${prefix}-${registeredAt.year}-${String(id).padStart(4, '0')}`
}
