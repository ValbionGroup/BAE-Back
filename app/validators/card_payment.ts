import vine from '@vinejs/vine'

export const cardPaymentOpenValidator = vine.create({
  lines: vine
    .array(
      vine.object({
        productId: vine.number().positive(),
        quantity: vine.number().withoutDecimals().positive(),
      })
    )
    .minLength(1),
  clientId: vine.number().positive().optional(),
  sponsorshipCategoryId: vine.number().positive().optional(),
  /**
   * ⚠️ L'unique montant que le panier a le droit d'envoyer — voir
   * `DiscountInput`. Le motif est obligatoire parce que `order_discounts.label`
   * l'est : une remise sans raison n'est pas vérifiable au bilan.
   */
  discount: vine
    .object({
      amountCents: vine.number().withoutDecimals().positive(),
      label: vine.string().trim().minLength(1).maxLength(120),
    })
    .optional(),
})
