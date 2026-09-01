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

export interface SeasonKpis {
  cashedCents: number
  cashedDeltaPct: number | null
  avgOrdersPerEvent: number
  ordersStdDev: number
  avgBasketCents: number
  avgBasketDeltaCents: number | null
  presenceRate: number
  presenceDeltaPts: number | null
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Écart-type de **population** : la série est la saison entière, pas un tirage. */
function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const average = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)))
}

interface Totals {
  cashedCents: number
  orderCount: number
  presentCount: number
  respondentCount: number
  basketCents: number
  presenceRate: number
}

function totalsOf(rows: SeasonEventRow[]): Totals {
  const past = rows.filter((current) => !current.upcoming)
  const cashedCents = past.reduce((sum, current) => sum + current.cashedCents, 0)
  const orderCount = past.reduce((sum, current) => sum + current.orderCount, 0)
  const presentCount = past.reduce((sum, current) => sum + current.presentCount, 0)
  const respondentCount = past.reduce((sum, current) => sum + current.respondentCount, 0)

  return {
    cashedCents,
    orderCount,
    presentCount,
    respondentCount,
    basketCents: orderCount === 0 ? 0 : Math.round(cashedCents / orderCount),
    presenceRate: respondentCount === 0 ? 0 : presentCount / respondentCount,
  }
}

export function kpisFor(rows: SeasonEventRow[], previous: SeasonEventRow[] | null): SeasonKpis {
  const now = totalsOf(rows)
  const before = previous === null ? null : totalsOf(previous)
  const orderCounts = rows
    .filter((current) => !current.upcoming)
    .map((current) => current.orderCount)

  return {
    cashedCents: now.cashedCents,
    cashedDeltaPct:
      before === null || before.cashedCents === 0
        ? null
        : Math.round(((now.cashedCents - before.cashedCents) / before.cashedCents) * 100),
    avgOrdersPerEvent: Math.round(mean(orderCounts)),
    ordersStdDev: Math.round(stdDev(orderCounts)),
    avgBasketCents: now.basketCents,
    avgBasketDeltaCents: before === null ? null : now.basketCents - before.basketCents,
    presenceRate: now.presenceRate,
    presenceDeltaPts:
      before === null ? null : Math.round((now.presenceRate - before.presenceRate) * 100),
  }
}
