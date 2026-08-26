import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ProductCategory from '#models/product_category'

/**
 * Le vocabulaire de **vente** : ce sont les onglets que la caisse affichera.
 * Semé en production, comme le catalogue RBAC et les postes.
 *
 * ⚠️ Distinct de celui des denrées (« Frais / Sec / Boissons », semé par
 * `08_good_seeder`), qui classe pour le **stockage**. « Boissons » figure dans
 * les deux sans que ce soit un doublon — ce ne sont pas les mêmes objets.
 */
export const CATEGORIES = ['Plats', 'Desserts', 'Boissons'] as const

export default class extends BaseSeeder {
  async run() {
    await ProductCategory.fetchOrCreateMany(
      'name',
      CATEGORIES.map((name) => ({ name }))
    )
  }
}
