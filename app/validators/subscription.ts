import vine from '@vinejs/vine'

export const createSubscriptionValidator = vine.create({
  userId: vine.number().positive(),
  fastPassId: vine.number().positive(),
  subscribedAt: vine.date({ formats: ['iso8601'] }).optional(),
  // Le paiement est facultatif : une cotisation peut être offerte, et
  // l'encaissement en ligne n'existe pas encore.
  payment: vine
    .object({
      amount: vine.number().withoutDecimals().min(0),
      type: vine.enum(['cash', 'lydia'] as const),
    })
    .optional(),
})

/**
 * Une formule d'adhésion (`fast_passes`).
 *
 * ⚠️ `price` est en **centimes entiers** et `duration` en **années**.
 * `openPayment` passe `price` tel quel à Lydia : un montant négatif ou
 * fractionnaire y partait sans le moindre contrôle.
 */
export const fastPassValidator = vine.create({
  label: vine.string().trim().minLength(1).maxLength(255),
  description: vine.string().trim().maxLength(1000).nullable().optional(),
  price: vine.number().withoutDecimals().min(0),
  duration: vine.number().withoutDecimals().positive(),
})
