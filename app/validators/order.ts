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
  // Contraint par l'enum de `transactions.type`.
  paymentMethod: vine.enum(['cash', 'lydia'] as const).optional(),
})

export const orderStatusValidator = vine.create({
  status: vine.enum(['pending', 'in_progress', 'ready', 'completed', 'cancelled'] as const),
})
