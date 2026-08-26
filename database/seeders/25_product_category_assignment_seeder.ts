import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DEMO_ONLY } from '#database/seeder_environment'
import Product from '#models/product'
import ProductCategory from '#models/product_category'
import { CATEGORIES } from '#database/seeders/24_product_category_seeder'

/**
 * Classe les recettes de démonstration dans les onglets de la caisse.
 *
 * ⚠️ Doit passer **après** `13_product_seeder`, qui crée les recettes, et après
 * `24_product_category_seeder`, qui crée les onglets.
 */
const BY_RECIPE: Readonly<Record<string, (typeof CATEGORIES)[number]>> = {
  'Hot-dog classique': 'Plats',
  'Hot-dog végétarien': 'Plats',
  'Frites portion': 'Plats',
  'Crêpe Nutella': 'Desserts',
  'Bière pression 25cl': 'Boissons',
}

export default class extends BaseSeeder {
  static environment = DEMO_ONLY

  async run() {
    const categories = await ProductCategory.query().whereIn('name', [...CATEGORIES])
    const byName = new Map(categories.map((category) => [category.name, category.id]))

    for (const [recipe, category] of Object.entries(BY_RECIPE)) {
      const product = await Product.findBy('name', recipe)
      if (!product) continue
      product.productCategoryId = byName.get(category) ?? null
      await product.save()
    }
  }
}
