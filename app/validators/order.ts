import vine from '@vinejs/vine'

/**
 * Le panier ne porte que des identifiants et des quantités : **aucun prix, aucun
 * total**. Le montant est relu de `event_products.price` côté serveur — un total
 * envoyé par le client serait falsifiable, et il s'agit d'argent.
 */
export const orderCheckoutValidator = vine.create({
  lines: vine
    .array(
      vine.object({
        productId: vine.number().positive(),
        quantity: vine.number().withoutDecimals().positive(),
      })
    )
    .minLength(1),
  clientId: vine.number().positive().optional(),
  // Un identifiant de catégorie, jamais un prix : le serveur relit la grille.
  sponsorshipCategoryId: vine.number().positive().optional(),
  // Contraint par l'enum de `transactions.type`.
  paymentMethod: vine.enum(['cash', 'lydia'] as const).optional(),
})

export const orderStatusValidator = vine.create({
  status: vine.enum(['pending', 'in_progress', 'ready', 'completed', 'cancelled'] as const),
})

/**
 * Déplacement du créneau de retrait d'une précommande par le staff.
 *
 * `null` est une valeur reçue, pas une absence : elle **retire** le créneau, ce
 * qui n'est pas la même chose que « ne pas y toucher ». D'où `nullable()` et
 * non `optional()`.
 *
 * L'alignement sur le quart d'heure et l'appartenance à la soirée ne sont pas
 * vérifiés ici : ils dépendent de la soirée, donc de la base. Voir
 * `assertPickupSlot` dans `pre_order_service`.
 */
export const preOrderPickupValidator = vine.create({
  pickupAt: vine.date({ formats: ['iso8601'] }).nullable(),
})
