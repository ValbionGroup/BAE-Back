import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Product from '#models/product'

/**
 * ⚠️ `products` porte deux rôles : c'est la **recette** et l'**article vendu**
 * (`order_products`, `event_products`, `pre_order_items`). Ces noms servent donc
 * aussi d'intitulés de caisse.
 */
const RECIPES: readonly { name: string; isVegetarian: boolean; recipe: string }[] = [
  {
    name: 'Hot-dog classique',
    isVegetarian: false,
    recipe: 'Chauffer la saucisse 3 min. Fendre le pain, moutarde, oignons frits.',
  },
  {
    name: 'Hot-dog végétarien',
    isVegetarian: true,
    recipe: 'Poêler le steak végétal 4 min par face. Même montage que le classique.',
  },
  {
    name: 'Frites portion',
    isVegetarian: true,
    recipe: 'Friture 170 °C, 4 min. Égoutter, saler à la sortie.',
  },
  {
    name: 'Crêpe Nutella',
    isVegetarian: true,
    recipe: 'Pâte reposée 30 min. Une louche par crêpe, garnir hors du feu.',
  },
  {
    name: 'Bière pression 25cl',
    isVegetarian: true,
    recipe: 'Verre incliné 45°, laisser deux doigts de mousse.',
  },
]

export default class extends BaseSeeder {
  async run() {
    await Product.fetchOrCreateMany(
      'name',
      RECIPES.map((recipe) => ({
        name: recipe.name,
        isVegetarian: recipe.isVegetarian,
        description: null,
        recipe: recipe.recipe,
      }))
    )
  }
}
