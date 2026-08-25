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
})
