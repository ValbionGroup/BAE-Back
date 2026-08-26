import { randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Event from '#models/event'
import SponsorshipCategory from '#models/sponsorship_category'
import ApiException from '#exceptions/api_exception'
import JwtService from '#services/jwt_service'
import { SPONSORSHIP_MODES } from '#validators/sponsorship'

export interface CategoryPrice {
  productId: number
  priceCents: number
}

export type SponsorshipMode = (typeof SPONSORSHIP_MODES)[number]

export interface CategoryPayload {
  id: number
  eventId: number
  label: string
  /** `external` : refacturée au payeur. `internal` : offerte par le BAE. */
  mode: SponsorshipMode
  prices: CategoryPrice[]
}

/** `null` retire la ligne — l'article repasse au prix public. `0` la garde à zéro. */
export interface PriceEntry {
  productId: number
  priceCents: number | null
}

function toPayload(category: SponsorshipCategory, prices: CategoryPrice[]): CategoryPayload {
  return {
    id: category.id,
    eventId: category.eventId,
    label: category.label,
    mode: category.mode as SponsorshipMode,
    prices: prices.sort((a, b) => a.productId - b.productId),
  }
}

async function pricesByCategory(
  categoryIds: readonly number[],
  trx?: TransactionClientContract
): Promise<Map<number, CategoryPrice[]>> {
  const byCategory = new Map<number, CategoryPrice[]>(categoryIds.map((id) => [id, []]))
  if (categoryIds.length === 0) return byCategory

  const rows = await (trx ?? db)
    .from('sponsorship_prices')
    .whereIn('category_id', [...categoryIds])
    .select('category_id', 'product_id', 'price_cents')

  for (const row of rows) {
    byCategory.get(Number(row.category_id))?.push({
      productId: Number(row.product_id),
      priceCents: Number(row.price_cents),
    })
  }

  return byCategory
}

export async function categoriesOf(eventId: number): Promise<CategoryPayload[]> {
  const categories = await SponsorshipCategory.query()
    .where('eventId', eventId)
    .orderBy('label', 'asc')

  const prices = await pricesByCategory(categories.map((category) => category.id))
  return categories.map((category) => toPayload(category, prices.get(category.id) ?? []))
}

export async function categoryOf(eventId: number, categoryId: number): Promise<CategoryPayload> {
  const category = await findCategory(eventId, categoryId)
  const prices = await pricesByCategory([category.id])
  return toPayload(category, prices.get(category.id) ?? [])
}

export async function findCategory(
  eventId: number,
  categoryId: number
): Promise<SponsorshipCategory> {
  const category = await SponsorshipCategory.query()
    .where('id', categoryId)
    .where('eventId', eventId)
    .first()

  if (!category) {
    throw new ApiException(
      'E_CATEGORY_NOT_FOUND',
      "Cette catégorie n'appartient pas à cette soirée.",
      422
    )
  }
  return category
}

/** Ce que la personne paie, par produit. Un produit absent se vend au prix public. */
export async function gridOf(
  categoryId: number,
  trx?: TransactionClientContract
): Promise<Map<number, number>> {
  const prices = await pricesByCategory([categoryId], trx)
  return new Map((prices.get(categoryId) ?? []).map((row) => [row.productId, row.priceCents]))
}

/**
 * Le payeur n'est exigé qu'en **externe** : c'est lui qui recevra le
 * justificatif. En interne il n'y a personne à réclamer — l'écart est offert,
 * et le bilan le compte en manque à gagner plutôt qu'en créance.
 */
async function requirePayerWhenExternal(event: Event, mode: SponsorshipMode): Promise<void> {
  if (mode === 'external' && !event.payerName) {
    throw new ApiException(
      'E_SPONSORSHIP_NO_PAYER',
      "Renseignez d'abord qui rembourse la différence.",
      422
    )
  }
}

/** Une catégorie déjà vendue est figée : son mode a servi à calculer un bilan. */
async function hasOrders(categoryId: number): Promise<boolean> {
  const sold = await db
    .from('orders')
    .where('sponsorship_category_id', categoryId)
    .select('id')
    .first()
  return Boolean(sold)
}

export async function create(
  eventId: number,
  label: string,
  mode: SponsorshipMode
): Promise<CategoryPayload> {
  const event = await Event.find(eventId)
  if (!event) {
    throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
  }

  await requirePayerWhenExternal(event, mode)

  const existing = await SponsorshipCategory.query()
    .where('eventId', eventId)
    .where('label', label)
    .first()
  if (existing) {
    throw new ApiException('E_CATEGORY_EXISTS', 'Cette catégorie existe déjà.', 422)
  }

  const category = await SponsorshipCategory.create({
    eventId,
    label,
    mode,
    qrNonce: randomBytes(8).toString('base64url'),
  })

  return toPayload(category, [])
}

export interface CategoryChanges {
  label?: string
  mode?: SponsorshipMode
}

/**
 * Le renommage reste libre — l'historique est protégé par la copie du libellé
 * sur `orders`. La **bascule de mode**, elle, se verrouille dès la première
 * commande : le bilan et le justificatif se lisent en joignant cette colonne,
 * donc la changer après coup réécrirait des documents déjà rendus.
 */
export async function update(
  eventId: number,
  categoryId: number,
  changes: CategoryChanges
): Promise<CategoryPayload> {
  const category = await findCategory(eventId, categoryId)

  if (changes.mode !== undefined && changes.mode !== category.mode) {
    if (await hasOrders(category.id)) {
      throw new ApiException(
        'E_CATEGORY_IN_USE',
        'Des commandes ont été passées sur cette catégorie : son mode ne peut plus changer.',
        409
      )
    }

    const event = await Event.findOrFail(eventId)
    await requirePayerWhenExternal(event, changes.mode)
    category.mode = changes.mode
  }

  if (changes.label !== undefined) category.label = changes.label

  await category.save()
  return categoryOf(eventId, categoryId)
}

export async function rotateNonce(eventId: number, categoryId: number): Promise<void> {
  const category = await findCategory(eventId, categoryId)
  category.qrNonce = randomBytes(8).toString('base64url')
  await category.save()
}

export async function setPrices(
  eventId: number,
  categoryId: number,
  entries: readonly PriceEntry[]
): Promise<CategoryPayload> {
  const category = await findCategory(eventId, categoryId)

  await db.transaction(async (trx) => {
    for (const entry of entries) {
      if (entry.priceCents === null) {
        await trx
          .from('sponsorship_prices')
          .where('category_id', category.id)
          .where('product_id', entry.productId)
          .delete()
        continue
      }

      await trx
        .table('sponsorship_prices')
        .insert({
          category_id: category.id,
          product_id: entry.productId,
          price_cents: entry.priceCents,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict(['category_id', 'product_id'])
        .merge(['price_cents', 'updated_at'])
    }
  })

  return categoryOf(eventId, categoryId)
}

export async function remove(eventId: number, categoryId: number): Promise<void> {
  const category = await findCategory(eventId, categoryId)

  if (await hasOrders(category.id)) {
    throw new ApiException(
      'E_CATEGORY_IN_USE',
      'Des commandes ont été passées sur cette catégorie : elle ne peut plus être supprimée.',
      409
    )
  }

  await category.delete()
}

export interface ScannedCategory extends CategoryPayload {
  payerName: string | null
}

/**
 * La grille voyage avec la réponse : le comptoir doit barrer les prix publics
 * dès le scan, sans second aller-retour.
 */
export async function categoryForQr(
  categoryId: number,
  nonce: string
): Promise<ScannedCategory | null> {
  const category = await SponsorshipCategory.query()
    .where('id', categoryId)
    .where('qrNonce', nonce)
    .preload('event')
    .first()

  if (!category) return null

  const prices = await pricesByCategory([category.id])
  return {
    ...toPayload(category, prices.get(category.id) ?? []),
    payerName: category.event.payerName,
  }
}

export async function qrTokenFor(eventId: number, categoryId: number): Promise<string> {
  const category = await findCategory(eventId, categoryId)
  const jwt = new JwtService()
  // Sans échéance : le QR est imprimé et affiché au comptoir toute la soirée.
  return jwt.generateQrToken(
    { type: 'sponsorship_category', categoryId: category.id, nonce: category.qrNonce },
    null
  )
}
