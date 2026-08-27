import { BaseSeeder } from '@adonisjs/lucid/seeders'
import StorageLocation from '#models/storage_location'
import { DEMO_ONLY } from '#database/seeder_environment'

/**
 * Le vocabulaire d'origine de `goods.storage_method`, redevenu une simple liste
 * que le BAE peut désormais étendre depuis la page Référentiels.
 *
 * ⚠️ **Ce seeder n'affecte aucune denrée.** La migration a supprimé la colonne
 * enum sans reprise, et deviner qu'un `'dry'` d'hier correspond au « Sec » créé
 * ici supposerait que ce vocabulaire soit le bon pour ce BAE — c'est précisément
 * la question que ce lot rouvre. Les emplacements se re-signalent denrée par
 * denrée depuis le panneau de détail des stocks.
 *
 * `fetchOrCreateMany` et non `updateOrCreateMany` : un lieu renommé à l'écran ne
 * doit pas revenir à son nom d'usine au prochain passage du seeder.
 */
export const STORAGE_LOCATIONS = ['Frigo', 'Congélateur', 'Sec', 'Cave'] as const

export default class extends BaseSeeder {
  /**
   * ⚠️ **Démo seulement.** La décision de ce lot est que la production
   * **reparte de zéro** : le BAE nomme ses propres rangements depuis l'écran,
   * et lui pré-remplir « Frigo / Congélateur / Sec / Cave » rétablirait par la
   * porte du seeder le vocabulaire figé qu'on vient de retirer de la base.
   */
  static environment = DEMO_ONLY

  async run() {
    await StorageLocation.fetchOrCreateMany(
      'name',
      STORAGE_LOCATIONS.map((name) => ({ name }))
    )
  }
}
