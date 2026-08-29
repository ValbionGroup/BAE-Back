import Furniture from '#models/furniture'
import Product from '#models/product'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DEMO_ONLY } from '#database/seeder_environment'

/**
 * Quantités en **unités entières** : un gobelet par bière, deux serviettes par
 * crêpe. Contrairement à `product_goods`, rien ici n'est une fraction d'unité
 * d'achat — on ne coupe pas une barquette en douze.
 *
 * ⚠️ La résolution se fait par **nom**, jamais par index. Attacher
 * `furnitures[0]` et `furnitures[1]` donnait à chaque produit deux serviettes et
 * cinq nappes, soit 3 750 nappes par soirée dans la liste de courses — un
 * chiffre absurde qui décrédibilisait l'écran entier.
 *
 * `Nappe jetable` et `Sac poubelle 50L` n'apparaissent volontairement dans
 * aucune ligne : ce sont des consommables **de soirée**, pas de produit. Rien
 * dans le schéma ne les porte à ce niveau aujourd'hui.
 */
const EQUIPMENT: Record<string, readonly [string, number][]> = {
  'Hot-dog classique': [
    ['Barquette carton', 1],
    ['Serviette papier', 1],
  ],
  'Hot-dog végétarien': [
    ['Barquette carton', 1],
    ['Serviette papier', 1],
  ],
  'Frites portion': [
    ['Barquette carton', 1],
    ['Couvert plastique', 1],
    ['Serviette papier', 1],
  ],
  'Crêpe Nutella': [['Serviette papier', 2]],
  'Bière pression 25cl': [['Gobelet 20cl', 1]],
}

export default class extends BaseSeeder {
  static environment = DEMO_ONLY

  async run() {
    const allFurnitures = await Furniture.all()
    const furnitures = new Map(allFurnitures.map((furniture) => [furniture.name, furniture.id]))
    const products = await Product.all()

    for (const product of products) {
      const lines = EQUIPMENT[product.name]
      if (!lines) continue

      const pivot: Record<number, { quantity: number }> = {}
      for (const [furnitureName, quantity] of lines) {
        const furnitureId = furnitures.get(furnitureName)
        if (furnitureId === undefined) continue
        pivot[furnitureId] = { quantity }
      }

      await product.related('furnitures').sync(pivot)
    }
  }
}
