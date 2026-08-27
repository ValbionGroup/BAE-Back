import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ProductCategory from '#models/product_category'
import { DEMO_ONLY } from '#database/seeder_environment'

/**
 * Le vocabulaire de **vente** : ce sont les onglets que la caisse affichera.
 *
 * ⚠️ Distinct de celui des denrées (« Frais / Sec / Boissons », semé par
 * `08_good_seeder`), qui classe pour le **stockage**. « Boissons » figure dans
 * les deux sans que ce soit un doublon — ce ne sont pas les mêmes objets.
 */
export const CATEGORIES = ['Plats', 'Desserts', 'Boissons'] as const

export default class extends BaseSeeder {
  /**
   * ⚠️ **Démo seulement.** Trois onglets sont un jeu de démonstration, pas un
   * référentiel : la carte d'un BAE se range comme il l'entend, et la page
   * Référentiels crée ces catégories (`category:write`). Les semer en
   * production imposerait notre découpage à l'écran de caisse, et les
   * ferait revenir après chaque suppression.
   */
  static environment = DEMO_ONLY

  async run() {
    await ProductCategory.fetchOrCreateMany(
      'name',
      CATEGORIES.map((name) => ({ name }))
    )
  }
}
