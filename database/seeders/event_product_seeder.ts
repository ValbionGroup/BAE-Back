import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Event from '#models/event'
import Product from '#models/product'

/**
 * Un menu sur les soirées existantes.
 *
 * Ce seeder n'existait pas du tout : `main_seeder.ts` ne le listait pas, et le
 * fichier était absent. Aucune soirée de développement n'avait donc de menu, la
 * liste de courses n'avait rien à calculer, et `products/summary.last_price`
 * était toujours nul.
 *
 * Les quantités sont volontairement supérieures au stock semé pour que la liste
 * de courses ait un manque à afficher — une liste vide ne démontre rien.
 *
 * `price` est le prix de **vente** en centimes.
 */
const MENU: readonly { recipe: string; quantity: number; price: number }[] = [
  { recipe: 'Hot-dog classique', quantity: 220, price: 350 },
  { recipe: 'Hot-dog végétarien', quantity: 40, price: 400 },
  { recipe: 'Frites portion', quantity: 180, price: 250 },
  { recipe: 'Crêpe Nutella', quantity: 90, price: 300 },
  { recipe: 'Bière pression 25cl', quantity: 220, price: 250 },
]

export default class extends BaseSeeder {
  async run() {
    const events = await Event.query().orderBy('date', 'asc')
    const allProducts = await Product.all()
    const products = new Map(allProducts.map((product) => [product.name, product.id]))

    if (events.length === 0) return

    // La soirée la plus proche reçoit le menu complet ; la suivante un menu
    // partiel, pour que l'écran montre les deux états « en préparation » et
    // « à planifier » sans données factices.
    const [first, second] = events

    const pivotOf = (lines: typeof MENU) => {
      const pivot: Record<number, { quantity: number; price: number }> = {}
      for (const line of lines) {
        const productId = products.get(line.recipe)
        if (productId === undefined) continue
        pivot[productId] = { quantity: line.quantity, price: line.price }
      }
      return pivot
    }

    await first.related('products').sync(pivotOf(MENU))
    if (second) await second.related('products').sync(pivotOf(MENU.slice(0, 2)))
  }
}
