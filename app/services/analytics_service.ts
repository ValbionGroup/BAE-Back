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
    from: DateTime.fromObject({ year: startYear, month: SEASON_START_MONTH, day: 1 }).startOf(
      'day'
    ),
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
  const orderCounts = rows
    .filter((current) => !current.upcoming)
    .map((current) => current.orderCount)

  /**
   * Une saison dont aucune soirée n'est encore achevée n'a rien à comparer :
   * la confronter à une saison n-1 complète afficherait « −100 % » sur un
   * écran qui n'a simplement pas encore commencé.
   */
  const comparable = previous !== null && orderCounts.length > 0
  const before = comparable ? totalsOf(previous) : null

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

/** Nombre de soirées achevées sur lesquelles la moyenne est prise. */
const PREDICTION_WINDOW = 6

/** `seasonal` : calée sur la soirée équivalente de n-1. `average` : à défaut. */
export type PredictionMethod = 'seasonal' | 'average'

export interface SeasonPrediction {
  eventId: number
  eventName: string
  expectedOrders: number
  range: number
  estimatedRevenueCents: number
  preOrderCount: number
  basedOnEventCount: number
  method: PredictionMethod
  /** Renseignés en méthode `seasonal` seulement : la soirée n-1 qui sert de base. */
  modelEventName: string | null
  modelEventDate: string | null
  modelOrderCount: number | null
  /** Recadrage appliqué, en pourcentage : `+15` vaut ×1,15, `0` est neutre. */
  trendPct: number | null
  /** Vrai quand les précommandes ont relevé l'estimation. */
  flooredByPreOrders: boolean
  /** La même prédiction, article par article — ce qu'il faut produire. */
  production: ProductionForecast
}

export interface ProductionForecastLine {
  productId: number
  productName: string
  categoryName: string
  /** Quantité déjà saisie au menu de la soirée (`event_products.quantity`). */
  plannedQty: number
  /** `null` quand le produit n'a aucun passé : on n'invente pas un chiffre. */
  expectedQty: number | null
  /** Déjà engagé en précommande sur cette soirée. */
  reservedQty: number
  flooredByPreOrders: boolean
}

export interface ProductionForecastCategory {
  categoryName: string
  plannedQty: number
  expectedQty: number
  lines: ProductionForecastLine[]
}

export interface ProductionForecast {
  categories: ProductionForecastCategory[]
  totalPlannedQty: number
  /** Tous produits confondus — ce que la soirée devrait écouler. */
  totalExpectedQty: number
  /** Lignes sans estimation ; le total les compte pour zéro. */
  linesWithoutBasis: number
}

const UNCATEGORISED = 'Sans catégorie'

/** Quantités vendues, par soirée et par produit. Clé : `eventId:productId`. */
async function soldByEventProduct(eventIds: number[]): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map()

  const rows = await db
    .from('orders')
    .join('order_products', 'order_products.order_id', 'orders.id')
    .whereIn('orders.event_id', eventIds)
    .whereNot('orders.status', 'cancelled')
    .groupBy('orders.event_id', 'order_products.product_id')
    .select('orders.event_id', 'order_products.product_id')
    .sum('order_products.quantity as qty')

  return new Map(
    rows.map((row) => [`${Number(row.event_id)}:${Number(row.product_id)}`, Number(row.qty ?? 0)])
  )
}

/**
 * Quels produits figuraient au menu de quelles soirées. Une soirée où le
 * produit n'était pas proposé ne compte pas comme une soirée à zéro vente —
 * elle ne compte pas du tout.
 */
async function menuMembership(eventIds: number[]): Promise<Map<number, Set<number>>> {
  if (eventIds.length === 0) return new Map()

  const rows = await db
    .from('event_products')
    .whereIn('event_id', eventIds)
    .select('event_id', 'product_id')

  const byEvent = new Map<number, Set<number>>()
  for (const row of rows) {
    const eventId = Number(row.event_id)
    const set = byEvent.get(eventId) ?? new Set<number>()
    set.add(Number(row.product_id))
    byEvent.set(eventId, set)
  }
  return byEvent
}

/** Quantités déjà précommandées sur une soirée, par produit. */
async function reservedByProduct(eventId: number): Promise<Map<number, number>> {
  const rows = await db
    .from('pre_orders')
    .join('pre_order_items', 'pre_order_items.pre_order_id', 'pre_orders.id')
    .where('pre_orders.event_id', eventId)
    .whereNot('pre_orders.status', 'cancelled')
    .groupBy('pre_order_items.product_id')
    .select('pre_order_items.product_id')
    .sum('pre_order_items.quantity as qty')

  return new Map(rows.map((row) => [Number(row.product_id), Number(row.qty ?? 0)]))
}

const EMPTY_FORECAST: ProductionForecast = {
  categories: [],
  totalPlannedQty: 0,
  totalExpectedQty: 0,
  linesWithoutBasis: 0,
}

/**
 * Combien produire de chaque article au menu de la soirée visée : la même
 * échelle que la prédiction de commandes, appliquée aux quantités.
 */
async function productionForecast(
  targetEventId: number,
  modelEventId: number | null,
  trend: number,
  recentEventIds: number[]
): Promise<ProductionForecast> {
  const menu = await db
    .from('event_products')
    .join('products', 'products.id', 'event_products.product_id')
    .leftJoin('product_categories', 'product_categories.id', 'products.product_category_id')
    .where('event_products.event_id', targetEventId)
    .select(
      'event_products.product_id',
      'event_products.quantity as planned',
      'products.name as product_name',
      'product_categories.name as category_name'
    )

  if (menu.length === 0) return EMPTY_FORECAST

  const historyIds = [
    ...new Set(modelEventId === null ? recentEventIds : [modelEventId, ...recentEventIds]),
  ]
  const sold = await soldByEventProduct(historyIds)
  const onMenu = await menuMembership(historyIds)
  const reserved = await reservedByProduct(targetEventId)

  const soldAt = (eventId: number, productId: number) => sold.get(`${eventId}:${productId}`) ?? 0
  const wasOnMenu = (eventId: number, productId: number) =>
    onMenu.get(eventId)?.has(productId) ?? false

  const lines: ProductionForecastLine[] = menu.map((row) => {
    const productId = Number(row.product_id)

    let base: number | null = null
    if (modelEventId !== null && wasOnMenu(modelEventId, productId)) {
      base = Math.round(soldAt(modelEventId, productId) * trend)
    } else {
      const seen = recentEventIds.filter((id) => wasOnMenu(id, productId))
      if (seen.length > 0) base = Math.round(mean(seen.map((id) => soldAt(id, productId))))
    }

    const reservedQty = reserved.get(productId) ?? 0
    const expectedQty =
      base === null ? (reservedQty > 0 ? reservedQty : null) : Math.max(base, reservedQty)

    return {
      productId,
      productName: String(row.product_name),
      categoryName: row.category_name === null ? UNCATEGORISED : String(row.category_name),
      plannedQty: Number(row.planned ?? 0),
      expectedQty,
      reservedQty,
      flooredByPreOrders: expectedQty !== null && (base === null || expectedQty > base),
    }
  })

  const byCategory = new Map<string, ProductionForecastLine[]>()
  for (const line of lines) {
    byCategory.set(line.categoryName, [...(byCategory.get(line.categoryName) ?? []), line])
  }

  const categories = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .map(([categoryName, categoryLines]) => {
      const sorted = [...categoryLines].sort((a, b) =>
        a.productName.localeCompare(b.productName, 'fr')
      )
      return {
        categoryName,
        plannedQty: sorted.reduce((sum, line) => sum + line.plannedQty, 0),
        expectedQty: sorted.reduce((sum, line) => sum + (line.expectedQty ?? 0), 0),
        lines: sorted,
      }
    })

  return {
    categories,
    totalPlannedQty: categories.reduce((sum, c) => sum + c.plannedQty, 0),
    totalExpectedQty: categories.reduce((sum, c) => sum + c.expectedQty, 0),
    linesWithoutBasis: lines.filter((line) => line.expectedQty === null).length,
  }
}

/** Trois semaines : au-delà, l'appariement rapprocherait Halloween de Noël. */
const MATCH_WINDOW_DAYS = 21

const TREND_MIN = 0.5
const TREND_MAX = 2

/**
 * La soirée de n-1 dont la date, décalée d'un an, tombe le plus près de la
 * cible. `null` si aucune ne tient dans la fenêtre.
 */
function matchedPreviousEvent(
  target: DateTime,
  previousRows: SeasonEventRow[]
): SeasonEventRow | null {
  let best: SeasonEventRow | null = null
  let bestGap = Number.POSITIVE_INFINITY

  for (const row of previousRows) {
    if (row.upcoming) continue

    const gap = Math.abs(DateTime.fromISO(row.date).plus({ years: 1 }).diff(target, 'days').days)
    if (gap <= MATCH_WINDOW_DAYS && gap < bestGap) {
      best = row
      bestGap = gap
    }
  }

  return best
}

/**
 * De combien la saison en cours dépasse n-1, en commandes par soirée. Exige
 * deux soirées achevées de chaque côté — sur une seule, la « tendance » ne
 * serait qu'un aléa — et reste bornée pour qu'une soirée hors norme ne double
 * pas la prédiction à elle seule.
 */
function seasonTrend(seasonRows: SeasonEventRow[], previousRows: SeasonEventRow[]): number {
  const now = seasonRows.filter((row) => !row.upcoming).map((row) => row.orderCount)
  const before = previousRows.filter((row) => !row.upcoming).map((row) => row.orderCount)
  if (now.length < 2 || before.length < 2) return 1

  const beforeMean = mean(before)
  if (beforeMean === 0) return 1

  return Math.min(TREND_MAX, Math.max(TREND_MIN, mean(now) / beforeMean))
}

/**
 * Nulle si rien n'est à venir, si rien d'achevé ne sert de base, ou si la
 * prochaine soirée tombe hors de la saison affichée — la carte parlerait alors
 * d'une soirée absente du graphe qu'elle surmonte.
 */
export async function predictionForSeason(
  startYear: number,
  avgBasketCents: number,
  seasonRows: SeasonEventRow[],
  previousRows: SeasonEventRow[]
): Promise<SeasonPrediction | null> {
  const next = await db
    .from('events')
    .whereNot('status', 'completed')
    .orderBy('date', 'asc')
    .select('id', 'name', 'date')
    .first()

  if (!next) return null

  const { from, to } = seasonBounds(startYear)
  const nextDate = DateTime.fromJSDate(new Date(next.date))
  if (nextDate < from || nextDate >= to) return null

  /**
   * `leftJoin`, et la condition sur le statut portée par la jointure : une
   * soirée tenue qui n'a rien vendu compte pour zéro, elle ne disparaît pas de
   * la moyenne. Un `join` strict doublait la prédiction en ne retenant que les
   * soirées ayant vendu.
   */
  const recent = await db
    .from('events')
    .leftJoin('orders', (join) => {
      join.on('orders.event_id', '=', 'events.id').andOnNotIn('orders.status', ['cancelled'])
    })
    .where('events.status', 'completed')
    .groupBy('events.id', 'events.date')
    .orderBy('events.date', 'desc')
    .limit(PREDICTION_WINDOW)
    .select('events.id')
    .countDistinct('orders.id as order_count')

  const counts = recent.map((row) => Number(row.order_count ?? 0))
  if (counts.length === 0) return null

  const preOrders = await db
    .from('pre_orders')
    .where('event_id', Number(next.id))
    .whereNot('status', 'cancelled')
    .count('* as total')
    .first()
  const preOrderCount = Number(preOrders?.total ?? 0)

  const model = matchedPreviousEvent(nextDate, previousRows)
  const trend = model ? seasonTrend(seasonRows, previousRows) : 1
  const base = model ? Math.round(model.orderCount * trend) : Math.round(mean(counts))

  const production = await productionForecast(
    Number(next.id),
    model === null ? null : model.id,
    trend,
    recent.map((row) => Number(row.id))
  )

  /** Jamais moins que ce qui est déjà réservé : le plancher est un fait, pas une estimation. */
  const expectedOrders = Math.max(base, preOrderCount)

  return {
    eventId: Number(next.id),
    eventName: String(next.name),
    expectedOrders,
    range: Math.round(stdDev(counts)),
    estimatedRevenueCents: expectedOrders * avgBasketCents,
    preOrderCount,
    basedOnEventCount: counts.length,
    method: model ? 'seasonal' : 'average',
    modelEventName: model?.name ?? null,
    modelEventDate: model?.date ?? null,
    modelOrderCount: model?.orderCount ?? null,
    trendPct: model ? Math.round((trend - 1) * 100) : null,
    flooredByPreOrders: expectedOrders > base,
    production,
  }
}

export interface SeasonOption extends SeasonRef {
  eventCount: number
}

export interface SeasonAnalytics {
  season: SeasonRef
  seasons: SeasonOption[]
  kpis: SeasonKpis
  events: SeasonEventRow[]
  prediction: SeasonPrediction | null
}

/** Les saisons portant au moins une soirée, de la plus récente à la plus ancienne. */
async function availableSeasons(): Promise<SeasonOption[]> {
  const dates = await db.from('events').select('date')
  const counts = new Map<number, number>()

  for (const row of dates) {
    const year = seasonStartYear(DateTime.fromJSDate(new Date(row.date)))
    counts.set(year, (counts.get(year) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort(([a], [b]) => b - a)
    .map(([startYear, eventCount]) => ({
      startYear,
      label: seasonLabel(startYear),
      eventCount,
    }))
}

/**
 * La saison en cours par défaut — pas la plus récente qui porte une soirée : une
 * soirée planifiée loin devant ouvre une saison future, et la page s'ouvrirait
 * sur un écran vide en ignorant la saison qu'on est en train de vivre. On ne se
 * rabat sur la plus récente que si la saison courante ne porte rien du tout.
 */
function defaultSeason(seasons: SeasonOption[]): number {
  const current = seasonStartYear(DateTime.now())
  if (seasons.some((season) => season.startYear === current)) return current
  return seasons[0]?.startYear ?? current
}

export async function analyticsForSeason(requested: number | null): Promise<SeasonAnalytics> {
  const seasons = await availableSeasons()
  const startYear = requested ?? defaultSeason(seasons)

  const [events, previous] = await Promise.all([
    eventRowsForSeason(startYear),
    eventRowsForSeason(startYear - 1),
  ])

  const hasPrevious = seasons.some((season) => season.startYear === startYear - 1)
  const kpis = kpisFor(events, hasPrevious ? previous : null)

  return {
    season: { startYear, label: seasonLabel(startYear) },
    seasons,
    kpis,
    events,
    prediction: await predictionForSeason(startYear, kpis.avgBasketCents, events, previous),
  }
}
