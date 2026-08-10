import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Good from '#models/good'
import Product from '#models/product'

/**
 * Composition explicite au lieu de 2-3 denrées tirées au hasard.
 *
 * L'aléatoire rendait la liste de courses ininterprétable — et surtout, il ne
 * produisait jamais d'ingrédient **partagé** entre deux recettes, qui est
 * précisément le cas que le calcul doit traiter correctement. Ici le pain et la
 * moutarde le sont, entre les deux hot-dogs.
 *
 * `rank` porte l'ordre d'assemblage, `instruction` l'étape correspondante :
 * c'est ce que la page d'accueil lira pour dire quoi assembler ce soir.
 */
const COMPOSITION: Record<string, readonly [string, number, string | null][]> = {
  'Hot-dog classique': [
    ['Pain hot-dog x12', 1, 'Fendre sans séparer'],
    ['Saucisses Strasbourg x10', 1, 'Chauffer 3 min'],
    ['Moutarde 270g', 1, 'Un trait dans la fente'],
    ['Oignons frits 100g', 1, 'Une pincée par dessus'],
  ],
  'Hot-dog végétarien': [
    ['Pain hot-dog x12', 1, 'Fendre sans séparer'],
    ['Steak végétal x8', 1, 'Poêler 4 min par face'],
    ['Moutarde 270g', 1, 'Un trait dans la fente'],
  ],
  'Frites portion': [
    ['Frites surgelées', 1, 'Friture 170 °C, 4 min'],
    ['Huile de friture', 1, 'Renouveler toutes les 20 portions'],
  ],
  'Crêpe Nutella': [
    ['Farine T55', 1, 'Pâte reposée 30 min'],
    ['Pâte à tartiner 400g', 1, 'Garnir hors du feu'],
  ],
  'Bière pression 25cl': [['Bière blonde 25cl x24', 1, 'Verre incliné 45°']],
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

      // `sync` et non `attach` : le seeder doit être rejouable, et `attach` sur
      // une paire existante viole la clé primaire composite du pivot.
      await product.related('goods').sync(pivot)
    }
  }
}
