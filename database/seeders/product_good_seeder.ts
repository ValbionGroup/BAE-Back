import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Good from '#models/good'
import Product from '#models/product'

/**
 * Quantités en **fraction d'unité d'achat** : `1 / 12` est un pain pris dans un
 * paquet de douze, `10 / 270` dix grammes pris dans un pot de 270 g.
 *
 * ⚠️ Les grammages sont **estimés** — aucun n'a été relevé en cuisine. Ils
 * rendent la marge lisible en développement ; les vraies recettes se saisissent
 * depuis la page Recettes.
 */
const COMPOSITION: Record<string, readonly [string, number, string | null][]> = {
  'Hot-dog classique': [
    ['Pain hot-dog x12', 1 / 12, 'Fendre sans séparer'],
    ['Saucisses Strasbourg x10', 1 / 10, 'Chauffer 3 min'],
    ['Moutarde 270g', 10 / 270, 'Un trait dans la fente'],
    ['Oignons frits 100g', 5 / 100, 'Une pincée par dessus'],
  ],
  'Hot-dog végétarien': [
    ['Pain hot-dog x12', 1 / 12, 'Fendre sans séparer'],
    ['Steak végétal x8', 1 / 8, 'Poêler 4 min par face'],
    ['Moutarde 270g', 10 / 270, 'Un trait dans la fente'],
  ],
  'Frites portion': [
    ['Frites surgelées', 0.15, 'Friture 170 °C, 4 min'],
    ['Huile de friture', 0.02, 'Renouveler toutes les 20 portions'],
  ],
  'Crêpe Nutella': [
    ['Farine T55', 0.03, 'Pâte reposée 30 min'],
    ['Pâte à tartiner 400g', 25 / 400, 'Garnir hors du feu'],
  ],
  'Bière pression 25cl': [['Bière blonde 25cl x24', 1 / 24, 'Verre incliné 45°']],
}

export default class extends BaseSeeder {
  async run() {
    const allGoods = await Good.all()
    const goods = new Map(allGoods.map((good) => [good.name, good.id]))
    const products = await Product.all()

    for (const product of products) {
      const lines = COMPOSITION[product.name]
      if (!lines) continue

      const pivot: Record<number, { quantity: number; rank: number; instruction: string | null }> =
        {}
      let rank = 1
      for (const [goodName, quantity, instruction] of lines) {
        const goodId = goods.get(goodName)
        if (goodId === undefined) continue
        pivot[goodId] = { quantity, rank: rank++, instruction }
      }

      await product.related('goods').sync(pivot)
    }
  }
}
