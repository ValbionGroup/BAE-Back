import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Good from '#models/good'
import Supplier from '#models/supplier'

/**
 * Chaque denrée référencée chez les trois enseignes, à un prix plausible.
 *
 * La version précédente attachait 2-3 denrées au hasard par enseigne, à des
 * prix tirés entre 10 et 1000 € : un comparatif presque vide, et un « optimum »
 * qui ne voulait rien dire. Ici la table est dense, donc l'économie
 * multi-enseigne est non nulle et vérifiable à l'œil.
 *
 * Les écarts sont **déterministes** (dérivés de l'id de la denrée) et non
 * aléatoires : deux `db:seed` de suite donnent les mêmes prix, ce qui rend une
 * capture d'écran comparable à la précédente.
 */
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

/** −4 %, référence, +6 % : Leclerc le moins cher en général, sans l'être partout. */
const RETAILER_FACTORS: Record<string, number> = {
  'Leclerc': 0.96,
  'Auchan': 1.0,
  'Carrefour': 1.06,
}

/**
 * Sert à désigner, par denrée, l'enseigne qui reçoit la remise ponctuelle
 * ci-dessous. Un simple index — l'ordre n'a pas d'autre signification.
 */
const RETAILER_ORDER = ['Leclerc', 'Auchan', 'Carrefour'] as const

export default class extends BaseSeeder {
  async run() {
    const goods = await Good.all()
    const suppliers = await Supplier.all()

    for (const supplier of suppliers) {
      const factor = RETAILER_FACTORS[supplier.name] ?? 1.0
      const retailerIndex = RETAILER_ORDER.indexOf(
        supplier.name as (typeof RETAILER_ORDER)[number]
      )
      const pivot: Record<number, { price: number }> = {}

      for (const good of goods) {
        const base = BASE_PRICES[good.name]
        if (base === undefined) continue
        // ⚠️ Un multiplicateur identique appliqué aux trois enseignes pour une
        // même denrée ne change JAMAIS laquelle est la moins chère : il ne fait
        // qu'agrandir ou rétrécir les trois prix ensemble, en préservant
        // l'ordre imposé par RETAILER_FACTORS (Leclerc gagnerait alors sur
        // toutes les lignes, et `savings` vaudrait toujours 0). Pour que la
        // meilleure enseigne change réellement de ligne en ligne, la remise
        // doit cibler une enseigne différente selon la denrée : ici, celle
        // désignée par `good.id % 3` reçoit −10 % sur cette ligne, ce qui
        // suffit à dépasser l'avantage structurel de Leclerc (−4 % contre
        // +6 % pour Carrefour).
        const favoredIndex = good.id % 3
        const wobble = retailerIndex === favoredIndex ? 0.9 : 1.0
        pivot[good.id] = { price: Number((base * factor * wobble).toFixed(2)) }
      }

      await supplier.related('goods').sync(pivot)
    }
  }
}
