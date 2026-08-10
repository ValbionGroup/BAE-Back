import vine from '@vinejs/vine'

/**
 * Ajout d'une recette au menu d'une soirée.
 *
 * Le fil envoie `product_id` en snake_case ; `case_converter_middleware` le
 * passe en camelCase avant que la validation ne tourne.
 *
 * `quantity` est un entier `>= 1` : zéro voudrait dire que la ligne ne devrait
 * pas exister, ce que `DELETE` exprime déjà. `price` est le prix de **vente** en
 * centimes ; absent, le contrôleur reporte le dernier prix connu du produit.
 */
export const eventProductValidator = vine.create({
  productId: vine.number().positive(),
  quantity: vine.number().withoutDecimals().min(1),
  price: vine.number().min(0).optional(),
})

/**
 * Mise à jour d'une ligne. Les deux champs sont optionnels : une clé absente
 * signifie « ne touche pas à cette colonne ».
 */
export const eventProductUpdateValidator = vine.create({
  quantity: vine.number().withoutDecimals().min(1).optional(),
  price: vine.number().min(0).optional(),
})
