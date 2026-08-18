import vine from '@vinejs/vine'

export const sponsorshipCategoryValidator = vine.create({
  label: vine.string().trim().minLength(1),
})

export const sponsorshipPricesValidator = vine.create({
  prices: vine.array(
    vine.object({
      productId: vine.number().positive(),
      // `null` retire la ligne : l'article repasse au prix public.
      priceCents: vine.number().withoutDecimals().min(0).nullable(),
    })
  ),
})
