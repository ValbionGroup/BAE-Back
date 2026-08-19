import vine from '@vinejs/vine'

/**
 * ⚠️ Aucun montant n'est accepté du client : le tarif est relu en base à chaque
 * ouverture de paiement. Un `amountCents` envoyé ici est ignoré, et c'est
 * délibéré — l'accepter reviendrait à laisser le payeur fixer son prix.
 */
export const createAccountSubscriptionValidator = vine.create({
  fastPassId: vine.number().positive(),
})
