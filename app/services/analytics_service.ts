import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

/** Une saison va du 1er août au 31 juillet ; `startYear` est l'année d'août. */
export interface SeasonRef {
  startYear: number
  label: string
}

const SEASON_START_MONTH = 8

export function seasonStartYear(date: DateTime): number {
  return date.month >= SEASON_START_MONTH ? date.year : date.year - 1
}

/** `to` est **exclusif** : il vaut le 1er août suivant, pas le 31 juillet. */
export function seasonBounds(startYear: number): { from: DateTime; to: DateTime } {
  return {
    from: DateTime.fromObject({ year: startYear, month: SEASON_START_MONTH, day: 1 }).startOf('day'),
    to: DateTime.fromObject({ year: startYear + 1, month: SEASON_START_MONTH, day: 1 }).startOf(
      'day'
    ),
  }
}

export function seasonLabel(startYear: number): string {
  return `Saison ${startYear}-${startYear + 1}`
}

export interface SeasonEventRow {
  id: number
  name: string
  date: string
  orderCount: number
  cashedCents: number
  presentCount: number
  respondentCount: number
  upcoming: boolean
}

/**
 * Les soirées d'une saison, par date croissante, chacune avec ce qu'elle a
 * encaissé et qui a répondu présent.
 */
export async function eventRowsForSeason(startYear: number): Promise<SeasonEventRow[]> {
  const { from, to } = seasonBounds(startYear)

  const events = await db
    .from('events')
    .where('date', '>=', from.toSQL({ includeOffset: false })!)
    .where('date', '<', to.toSQL({ includeOffset: false })!)
    .orderBy('date', 'asc')
    .select('id', 'name', 'date', 'status')

  if (events.length === 0) return []

  const ids = events.map((event) => Number(event.id))

  const orderRows = await db
    .from('orders')
    .leftJoin('order_products', 'order_products.order_id', 'orders.id')
    .whereIn('orders.event_id', ids)
    .whereNot('orders.status', 'cancelled')
    .groupBy('orders.event_id')
    .select('orders.event_id')
    .countDistinct('orders.id as order_count')
    .sum({ cashed: db.raw('order_products.unit_price_cents * order_products.quantity') })

  const ordersBy = new Map(
    orderRows.map((row) => [
      Number(row.event_id),
      { orderCount: Number(row.order_count ?? 0), cashedCents: Number(row.cashed ?? 0) },
    ])
  )

  const responseRows = await db
    .from('member_responses')
    .whereIn('event_id', ids)
    .groupBy('event_id')
    .select('event_id')
    .count('* as respondents')
    .select(db.raw('COUNT(*) FILTER (WHERE is_available) as presents'))

  const responsesBy = new Map(
    responseRows.map((row) => [
      Number(row.event_id),
      { presentCount: Number(row.presents ?? 0), respondentCount: Number(row.respondents ?? 0) },
    ])
  )

  return events.map((event) => {
    const id = Number(event.id)
    const orders = ordersBy.get(id) ?? { orderCount: 0, cashedCents: 0 }
    const responses = responsesBy.get(id) ?? { presentCount: 0, respondentCount: 0 }

    return {
      id,
      name: String(event.name),
      date: DateTime.fromJSDate(new Date(event.date)).toISO()!,
      orderCount: orders.orderCount,
      cashedCents: orders.cashedCents,
      presentCount: responses.presentCount,
      respondentCount: responses.respondentCount,
      upcoming: event.status !== 'completed',
    }
  })
}
