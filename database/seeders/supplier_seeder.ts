import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Supplier from '#models/supplier'

/**
 * Trois enseignes réelles au lieu de dix noms d'entreprise tirés par faker.
 *
 * `fetchOrCreateMany` sur le nom rend le seeder **rejouable** : la version
 * précédente faisait `createMany(10)`, donc chaque `db:seed` ajoutait dix
 * enseignes de plus — d'où les quinze colonnes creuses du comparatif.
 */
const RETAILERS = ['Leclerc', 'Auchan', 'Carrefour'] as const

export default class extends BaseSeeder {
  async run() {
    await Supplier.fetchOrCreateMany(
      'name',
      RETAILERS.map((name) => ({ name }))
    )
  }
}
