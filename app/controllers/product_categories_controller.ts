import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import ProductCategory from '#models/product_category'
import { productCategoryUpdateValidator, productCategoryValidator } from '#validators/catalog'

export default class ProductCategoriesController {
  /**
   * Le compteur dit ce qu'une suppression déclasserait — agrégat groupé, jamais
   * un `preload` : celui-ci ramènerait toutes les recettes de chaque catégorie
   * pour n'en compter que les lignes. Patron d'`EventsController.index`.
   */
  async index({ serialize }: HttpContext) {
    const categories = await ProductCategory.query().orderBy('name')

    const rows = await db
      .from('products')
      .whereNotNull('product_category_id')
      .select('product_category_id')
      .count('* as total')
      .groupBy('product_category_id')

    const countBy = new Map(rows.map((row) => [Number(row.product_category_id), Number(row.total)]))

    return serialize(
      categories.map((category) => ({
        ...category.serialize(),
        productsCount: countBy.get(category.id) ?? 0,
      }))
    )
  }

  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(productCategoryValidator)
    return serialize(await ProductCategory.create(payload))
  }

  async update({ params, request, serialize }: HttpContext) {
    const category = await ProductCategory.findOrFail(params.id)
    category.merge(await request.validateUsing(productCategoryUpdateValidator))
    await category.save()
    return serialize(category)
  }

  /**
   * ⚠️ **Aucun garde-fou 409, contrairement aux enseignes.** La FK est en
   * `SET NULL` : les recettes sont déclassées, pas détruites. L'écran annonce
   * combien, et c'est suffisant — refuser ici serait une rigidité sans
   * contrepartie.
   */
  async destroy({ params, response }: HttpContext) {
    const category = await ProductCategory.findOrFail(params.id)
    await category.delete()
    return response.noContent()
  }
}
