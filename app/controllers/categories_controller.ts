import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import db from '@adonisjs/lucid/services/db'
import { categoryUpdateValidator, categoryValidator } from '#validators/catalog'

export default class CategoriesController {
  /**
   * ⚠️ Le compteur n'est pas décoratif : c'est lui qui rend la suppression
   * compréhensible. Supprimer une catégorie déclasse ses denrées
   * (`goods.category_id` est en `SET NULL`), et l'écran doit pouvoir annoncer
   * combien avant le clic.
   *
   * Agrégat groupé plutôt que `preload('goods')`, patron d'`EventsController.index` :
   * un préchargement ramènerait tout le catalogue pour n'en compter que les lignes.
   */
  async index({ serialize }: HttpContext) {
    const categories = await Category.query().orderBy('name')

    const rows = await db
      .from('goods')
      .whereNotNull('category_id')
      .select('category_id')
      .count('* as total')
      .groupBy('category_id')

    const goodsBy = new Map(rows.map((row) => [Number(row.category_id), Number(row.total)]))

    return serialize(
      categories.map((category) => ({
        ...category.serialize(),
        goodsCount: goodsBy.get(category.id) ?? 0,
      }))
    )
  }

  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(categoryValidator)
    return serialize(await Category.create(payload))
  }

  async show({ params, serialize }: HttpContext) {
    return serialize(await Category.findOrFail(params.id))
  }

  async update({ params, request, serialize }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    const payload = await request.validateUsing(categoryUpdateValidator)
    category.merge(payload)
    await category.save()
    return serialize(category)
  }

  async destroy({ params }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    return category.delete()
  }
}
