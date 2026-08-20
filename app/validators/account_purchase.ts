import vine from '@vinejs/vine'

/**
 * ⚠️ Aucun montant n'est accepté du client : le tarif est relu en base à chaque
 * ouverture de paiement. Un `amountCents` envoyé ici est ignoré, et c'est
 * délibéré — l'accepter reviendrait à laisser le payeur fixer son prix.
 */
export const createAccountSubscriptionValidator = vine.create({
  fastPassId: vine.number().positive(),
})

export const createAccountPreOrderValidator = vine.create({
  eventId: vine.number().positive(),
  pickupAt: vine.date({ formats: ['iso8601'] }).optional(),
  lines: vine
    .array(
      vine.object({
        productId: vine.number().positive(),
        // Plafond volontairement bas : une précommande est un repas, pas une
        // commande de gros, et un nombre aberrant coûterait à la cuisine.
        quantity: vine.number().positive().max(50),
      })
    )
    .minLength(1),
})
