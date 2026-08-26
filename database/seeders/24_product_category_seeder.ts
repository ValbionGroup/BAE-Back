import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Product from '#models/product'
import ProductCategory from '#models/product_category'

/**
 * Le vocabulaire de **vente** : ce sont les onglets que la caisse affichera.
 *
 * ⚠️ Distinct de celui des denrées (« Frais / Sec / Boissons », semé par
 * `08_good_seeder`), qui classe pour le **stockage**. « Boissons » figure dans
 * les deux sans que ce soit un doublon — ce ne sont pas les mêmes objets.
 *
 * ⚠️ Numéroté 24 : il doit passer **après** `13_product_seeder`, qui crée les
 * recettes. Ne pas l'insérer en `14_`, déjà pris par `14_restock_seeder` —
 * renuméroter décalerait toute la suite.
 */
const CATEGORIES = ['Plats', 'Desserts', 'Boissons'] as const

const BY_RECIPE: Readonly<Record<string, (typeof CATEGORIES)[number]>> = {
  'Hot-dog classique': 'Plats',
  'Hot-dog végétarien': 'Plats',
  'Frites portion': 'Plats',
  'Crêpe Nutella': 'Desserts',
  'Bière pression 25cl': 'Boissons',
}

export default class extends BaseSeeder {
  async run() {
    const categories = await ProductCategory.fetchOrCreateMany(
      'name',
      CATEGORIES.map((name) => ({ name }))
    )
    const byName = new Map(categories.map((category) => [category.name, category.id]))

    for (const [recipe, category] of Object.entries(BY_RECIPE)) {
      const product = await Product.findBy('name', recipe)
      if (!product) continue
      product.productCategoryId = byName.get(category) ?? null
      await product.save()
    }
  }
}
