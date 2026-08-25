import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Good from '#models/good'
import Supplier from '#models/supplier'

// Prix en **centimes**, comme toute valeur monétaire depuis le 2026-08-25.
const BASE_PRICES: Record<string, number> = {
  'Saucisses Strasbourg x10': 495,
  'Pain hot-dog x12': 275,
  'Moutarde 270g': 179,
  'Oignons frits 100g': 145,
  'Frites surgelées': 240,
  'Huile de friture': 320,
  'Steak végétal x8': 560,
  'Farine T55': 110,
  'Pâte à tartiner 400g': 345,
  'Bière blonde 25cl x24': 1195,
}

const RETAILER_FACTORS: Record<string, number> = {
  Leclerc: 0.96,
  Auchan: 1.0,
  Carrefour: 1.06,
}

const RETAILER_ORDER = ['Leclerc', 'Auchan', 'Carrefour'] as const

export default class extends BaseSeeder {
  async run() {
    const goods = await Good.all()
    const suppliers = await Supplier.all()

    for (const supplier of suppliers) {
      const factor = RETAILER_FACTORS[supplier.name] ?? 1.0
      const retailerIndex = RETAILER_ORDER.indexOf(supplier.name as (typeof RETAILER_ORDER)[number])
      const pivot: Record<number, { price: number }> = {}

      for (const good of goods) {
        const base = BASE_PRICES[good.name]
        if (base === undefined) continue
        const favoredIndex = good.id % 3
        const wobble = retailerIndex === favoredIndex ? 0.9 : 1.0
        // `factor` et `wobble` sont fractionnaires : sans arrondi explicite, un
        // flottant partirait dans une colonne entière.
        pivot[good.id] = { price: Math.round(base * factor * wobble) }
      }

      await supplier.related('goods').sync(pivot)
    }
  }
}
