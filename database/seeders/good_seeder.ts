import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'
import Good from '#models/good'

const CATEGORIES = ['Frais', 'Sec', 'Boissons'] as const

const GOODS: readonly { name: string; unit: string; brand: string; category: string }[] = [
  { name: 'Saucisses Strasbourg x10', unit: 'pcs', brand: 'Herta', category: 'Frais' },
  { name: 'Pain hot-dog x12', unit: 'pcs', brand: 'Harrys', category: 'Sec' },
  { name: 'Moutarde 270g', unit: 'pcs', brand: 'Amora', category: 'Sec' },
  { name: 'Oignons frits 100g', unit: 'pcs', brand: 'Maison', category: 'Sec' },
  { name: 'Frites surgelées', unit: 'kg', brand: 'McCain', category: 'Frais' },
  { name: 'Huile de friture', unit: 'liter', brand: 'Fritol', category: 'Sec' },
  { name: 'Steak végétal x8', unit: 'pcs', brand: 'Garden', category: 'Frais' },
  { name: 'Farine T55', unit: 'kg', brand: 'Francine', category: 'Sec' },
  { name: 'Pâte à tartiner 400g', unit: 'pcs', brand: 'Nutella', category: 'Sec' },
  { name: 'Bière blonde 25cl x24', unit: 'pcs', brand: 'Kronenbourg', category: 'Boissons' },
]

export default class extends BaseSeeder {
  async run() {
    const categories = await Category.fetchOrCreateMany(
      'name',
      CATEGORIES.map((name) => ({ name }))
    )
    const byName = new Map(categories.map((category) => [category.name, category.id]))

    await Good.fetchOrCreateMany(
      'name',
      GOODS.map((good) => ({
        name: good.name,
        unit: good.unit,
        brand: good.brand,
        categoryId: byName.get(good.category) ?? null,
      }))
    )
  }
}
