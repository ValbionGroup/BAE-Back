import vine from '@vinejs/vine'

/**
 * ⚠️ **`goods` est volontairement absent.** Les ingrédients gardent leur analyse
 * dédiée (`parseIngredients` dans `ProductsController`), qui fait plus qu'une
 * validation de forme : elle vérifie l'existence de chaque denrée et construit
 * la charge du pivot, `rank` compris. Les dupliquer ici les ferait diverger.
 */
const productFields = {
  name: vine.string().trim().minLength(1).maxLength(255),
  isVegetarian: vine.boolean().optional(),
  description: vine.string().trim().nullable().optional(),
  recipe: vine.string().trim().nullable().optional(),
  /** La catégorie de **vente** ; `null` déclasse explicitement. */
  productCategoryId: vine.number().positive().nullable().optional(),
}

export const productValidator = vine.create(productFields)

/**
 * ⚠️ **`name` reste requis**, contrairement à `eventUpdateValidator`. Cet
 * endpoint a toujours exigé le nom — il remplace la recette entière — et le
 * rendre optionnel ici ferait répondre 400 à un PUT sans nom là où un POST sans
 * nom répond 422. Une même absence, deux statuts : c'est ce qu'il faut éviter.
 *
 * Les autres champs restent optionnels, et Vine omet les clés absentes : une
 * écriture qui tait la catégorie ne déclasse donc pas la recette.
 */
export const productUpdateValidator = vine.create(productFields)
