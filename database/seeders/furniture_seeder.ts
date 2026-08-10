import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Furniture from '#models/furniture'

/**
 * Du non-alimentaire nommé et à prix plausible, à la place de
 * `FurnitureFactory.createMany(10)` (noms et prix faker, non rejouable).
 *
 * La liste de courses a une section « Non-alimentaire » dédiée : ces noms et
 * ces prix sont donc lus à l'écran, comme les denrées. Les quantités que
 * consomme une soirée grill vont de l'unité (une nappe) à la centaine
 * (serviettes, gobelets) ; les prix vont de quelques centimes à quelques
 * dizaines de centimes pièce — jamais les 10-1000 € que tirait faker pour les
 * denrées avant la réécriture du Step 2.
 *
 * `quantity` porte le stock déjà en réserve, comme `furnitures.quantity` dans
 * le calcul de la liste de courses (`shopping_list_service.ts`) : le
 * non-alimentaire n'a pas de lots, son stock est la ligne elle-même.
 */
const FURNITURES: readonly { name: string; price: number; quantity: number }[] = [
  { name: 'Serviette papier', price: 0.01, quantity: 800 },
  { name: 'Barquette carton', price: 0.08, quantity: 300 },
  { name: 'Gobelet 20cl', price: 0.03, quantity: 500 },
  { name: 'Couvert plastique', price: 0.02, quantity: 600 },
  { name: 'Nappe jetable', price: 0.45, quantity: 15 },
  { name: 'Sac poubelle 50L', price: 0.15, quantity: 60 },
]

export default class extends BaseSeeder {
  async run() {
    await Furniture.fetchOrCreateMany(
      'name',
      FURNITURES.map((furniture) => ({
        name: furniture.name,
        // `price` est un `decimal` en base, donc typé `string` côté modèle
        // (cf. `database/schema.ts`) : jamais lu comme un nombre sans
        // conversion explicite, jamais écrit comme un nombre non plus.
        price: furniture.price.toFixed(2),
        quantity: furniture.quantity,
      }))
    )
  }
}
