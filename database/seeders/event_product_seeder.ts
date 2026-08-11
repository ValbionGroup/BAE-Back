import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Event from '#models/event'
import Product from '#models/product'

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
