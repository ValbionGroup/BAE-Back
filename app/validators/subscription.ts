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
