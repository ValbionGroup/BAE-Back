import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Good from '#models/good'
import ApiException from '#exceptions/api_exception'
import { bestSupplierPrice, supplierPrices } from '#services/pricing_service'
import Supplier from '#models/supplier'
import StorageLocation from '#models/storage_location'
import {
  supplierPriceValidator,
  goodBarcodeValidator,
  goodStorageLocationValidator,
} from '#validators/catalog'

const UNIQUE_VIOLATION = '23505'

function rethrowBarcodeConflict(error: unknown): never {
  if ((error as { code?: string })?.code === UNIQUE_VIOLATION) {
    throw new ApiException(
      'E_BARCODE_TAKEN',
      'Ce code-barres est déjà associé à un autre produit.',
      409
    )
  }
  throw error
}

/**
 * ⚠️ La requête est partagée par `index`, `show` et `update` **exprès**. Les
 * tarifs vivent sur le pivot (`$extras.pivot_price`) et ne se sérialisent pas
 * seuls : `preload('suppliers')` sans `supplierPrices` rend des enseignes sans
 * montant. Les trois routes avaient déjà divergé une fois là-dessus ; les
 * codes-barres ajoutent un second `preload` à ne pas oublier, d'où le point
 * unique.
 */
function goodQuery() {
  return Good.query()
    .preload('products')
    .preload('category')
    .preload('storageLocation')
    .preload('suppliers')
    .preload('barcodes')
}

function present(good: Good) {
  const best = bestSupplierPrice(good)
  return {
    ...good.serialize(),
    barcodes: good.barcodes.map((barcode) => barcode.code),
    suppliers: supplierPrices(good),
    bestSupplier: best,
    bestPrice: best?.price ?? null,
  }
}

/**
 * ⚠️ Un `storageLocationId` inconnu doit rendre **404**, pas une violation de
 * clé étrangère en 500. Même règle que `E_PRODUCT_CATEGORY_NOT_FOUND` — et le
 * front en dépend : `messageOf` affiche la phrase du serveur, pas un code SQL.
 *
 * `null` et `undefined` passent sans vérification : ils n'ont aucune ligne à
 * désigner.
 */
async function assertStorageLocationExists(id: number | null | undefined): Promise<void> {
  if (id === null || id === undefined) return

  const location = await StorageLocation.find(id)
  if (location === null) {
    throw new ApiException(
      'E_STORAGE_LOCATION_NOT_FOUND',
      "Cet emplacement de stockage n'existe pas.",
      404
    )
  }
}

/** Les codes d'une création : `barcodes` en principal, `barcode` seul toléré. */
function codesFrom(payload: Record<string, unknown>): string[] {
  const raw = [
    ...(Array.isArray(payload.barcodes) ? payload.barcodes : []),
    ...(payload.barcode ? [payload.barcode] : []),
  ]
  const codes = raw.map((code) => String(code).trim()).filter((code) => code !== '')
  return [...new Set(codes)]
}

export default class GoodsController {
  async index({ request, serialize }: HttpContext) {
    const barcode = request.qs().barcode
    const goods = await goodQuery()
      .if(barcode, (query) =>
        query.whereHas('barcodes', (sub) => sub.where('code', String(barcode)))
      )
      .orderBy('name')

    return serialize(goods.map(present))
  }

  /**
   * Denrée et codes dans **une** transaction : sans elle, un code refusé
   * laisserait derrière lui une denrée sans code, et la personne qui recommence
   * en créerait une seconde — le doublon que les codes multiples suppriment.
   */
  async store({ request, serialize }: HttpContext) {
    const payload = request.all()
    const { name, unit, brand, categoryId } = payload
    const { storageLocationId } = await goodStorageLocationValidator.validate({
      storageLocationId: payload.storageLocationId,
    })
    await assertStorageLocationExists(storageLocationId)
    const codes = codesFrom(payload)

    const good = await db
      .transaction(async (trx) => {
        const created = new Good()
        created.useTransaction(trx)
        created.name = name
        created.unit = unit
        created.brand = brand ?? ''
        created.categoryId = categoryId
        created.storageLocationId = storageLocationId ?? null
        await created.save()

        if (codes.length > 0) {
          await created.related('barcodes').createMany(codes.map((code) => ({ code })))
        }
        return created
      })
      .catch(rethrowBarcodeConflict)

    await good.load('barcodes')
    return serialize({ ...good.serialize(), barcodes: good.barcodes.map((b) => b.code) })
  }

  async show({ params, serialize }: HttpContext) {
    const good = await goodQuery().where('id', params.id).firstOrFail()
    return serialize(present(good))
  }

  /** Les codes ne passent plus par ici : ils ont leurs propres routes. */
  /**
   * ⚠️ Chaque champ n'est affecté **que s'il est présent**. Les trois premiers
   * ne l'étaient pas : sur un PATCH partiel, `good.name = payload.name`
   * écrasait le nom avec `undefined`. Signaler l'emplacement d'une denrée
   * effaçait donc son nom, son unité et sa catégorie — `brand` portait déjà le
   * bon motif, seul.
   *
   * L'écart entre « clé absente » et « clé à `null` » porte le sens pour
   * `storageLocationId` : ne pas y toucher, ou l'effacer.
   */
  async update({ params, request, serialize }: HttpContext) {
    const good = await goodQuery().where('id', params.id).firstOrFail()
    const payload = request.all()
    const { storageLocationId } = await goodStorageLocationValidator.validate({
      storageLocationId: payload.storageLocationId,
    })
    await assertStorageLocationExists(storageLocationId)

    if ('name' in payload) good.name = payload.name
    if ('unit' in payload) good.unit = payload.unit
    if ('categoryId' in payload) good.categoryId = payload.categoryId
    if ('brand' in payload) good.brand = payload.brand ?? ''
    if ('storageLocationId' in payload) good.storageLocationId = storageLocationId ?? null

    await good.save()
    return serialize(present(good))
  }

  async destroy({ params }: HttpContext) {
    const good = await Good.query().where('id', params.id).firstOrFail()
    await good.delete()
  }

  /** Rattache un code lu au scanner à une denrée déjà connue. */
  async attachBarcode({ params, request, serialize }: HttpContext) {
    const good = await Good.query().where('id', params.id).firstOrFail()
    const { code } = await request.validateUsing(goodBarcodeValidator)

    const barcode = await good.related('barcodes').create({ code }).catch(rethrowBarcodeConflict)

    return serialize({ goodId: good.id, code: barcode.code })
  }

  async removeBarcode({ params, response }: HttpContext) {
    const good = await Good.query().where('id', params.id).firstOrFail()

    // Vérifié avant de supprimer : un `delete` sur un code absent ne dirait rien,
    // et l'écran croirait avoir détaché un code encore en place ailleurs.
    const barcode = await good
      .related('barcodes')
      .query()
      .where('code', String(params.code))
      .first()

    if (!barcode) {
      throw new ApiException(
        'E_BARCODE_NOT_FOUND',
        "Ce code-barres n'est pas rattaché à ce produit.",
        404
      )
    }

    await barcode.delete()
    return response.noContent()
  }

  /**
   * Pose ou corrige le tarif d'une denrée chez une enseigne — **le même geste**
   * du point de vue de l'utilisateur, donc la même route.
   *
   * ⚠️ Ce prix décide de trois écrans : `bestSupplierPrice` en fait le prix de
   * référence du coût de recette, de la liste de courses et du bilan. Saisir
   * moins cher ailleurs les déplace tous les trois.
   */
  async setSupplierPrice({ params, request, response }: HttpContext) {
    const good = await Good.query().where('id', params.id).firstOrFail()
    const { priceCents } = await request.validateUsing(supplierPriceValidator)

    // Vérifié explicitement : sans ça, un identifiant inconnu remonterait en
    // violation de clé étrangère, donc en 500 illisible.
    const supplier = await Supplier.find(params.supplierId)
    if (!supplier) {
      throw new ApiException('E_SUPPLIER_NOT_FOUND', "Cette enseigne n'existe pas.", 404)
    }

    // `sync(..., false)` : détacher les autres enseignes effacerait les tarifs
    // qu'on ne touche pas.
    await good.related('suppliers').sync({ [supplier.id]: { price: priceCents } }, false)

    return response.ok({ goodId: good.id, supplierId: supplier.id, priceCents })
  }

  async removeSupplierPrice({ params, response }: HttpContext) {
    const good = await Good.query().where('id', params.id).firstOrFail()
    await good.related('suppliers').detach([Number(params.supplierId)])
    return response.noContent()
  }
}
