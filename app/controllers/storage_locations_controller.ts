import type { HttpContext } from '@adonisjs/core/http'
import StorageLocation from '#models/storage_location'
import db from '@adonisjs/lucid/services/db'
import { storageLocationUpdateValidator, storageLocationValidator } from '#validators/catalog'

export default class StorageLocationsController {
  /**
   * ⚠️ Le compteur n'est pas décoratif, exactement comme celui des catégories :
   * c'est lui qui rend la suppression compréhensible. Supprimer un lieu déclasse
   * ses denrées (`goods.storage_location_id` est en `SET NULL`), et l'écran doit
   * pouvoir annoncer combien avant le clic.
   *
   * Agrégat groupé plutôt que `preload('goods')`, patron de `CategoriesController` :
   * un préchargement ramènerait tout le catalogue pour n'en compter que les lignes.
   */
  async index({ serialize }: HttpContext) {
    const locations = await StorageLocation.query().orderBy('name')

    const rows = await db
      .from('goods')
      .whereNotNull('storage_location_id')
      .select('storage_location_id')
      .count('* as total')
      .groupBy('storage_location_id')

    const goodsBy = new Map(rows.map((row) => [Number(row.storage_location_id), Number(row.total)]))

    return serialize(
      locations.map((location) => ({
        ...location.serialize(),
        goodsCount: goodsBy.get(location.id) ?? 0,
      }))
    )
  }

  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(storageLocationValidator)
    return serialize(await StorageLocation.create(payload))
  }

  async show({ params, serialize }: HttpContext) {
    return serialize(await StorageLocation.findOrFail(params.id))
  }

  async update({ params, request, serialize }: HttpContext) {
    const location = await StorageLocation.findOrFail(params.id)
    const payload = await request.validateUsing(storageLocationUpdateValidator)
    location.merge(payload)
    await location.save()
    return serialize(location)
  }

  /** `noContent()` explicite, patron de `ProductCategoriesController` : rendre
   *  la promesse de `delete()` laisse un 200 avec un corps vide. */
  async destroy({ params, response }: HttpContext) {
    const location = await StorageLocation.findOrFail(params.id)
    await location.delete()
    return response.noContent()
  }
}
