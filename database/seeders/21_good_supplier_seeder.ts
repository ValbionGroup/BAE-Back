import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Good from '#models/good'
import Supplier from '#models/supplier'

const BASE_PRICES: Record<string, number> = {
  'Saucisses Strasbourg x10': 4.95,
  'Pain hot-dog x12': 2.75,
  'Moutarde 270g': 1.79,
  'Oignons frits 100g': 1.45,
  'Frites surgelées': 2.4,
  'Huile de friture': 3.2,
  'Steak végétal x8': 5.6,
  'Farine T55': 1.1,
  'Pâte à tartiner 400g': 3.45,
  'Bière blonde 25cl x24': 11.95,
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
        pivot[good.id] = { price: Number((base * factor * wobble).toFixed(2)) }
      }

      await supplier.related('goods').sync(pivot)
    }
  }
}
