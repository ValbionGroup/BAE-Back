import vine from '@vinejs/vine'

export const eventProductValidator = vine.create({
  productId: vine.number().positive(),
  quantity: vine.number().withoutDecimals().min(1),
  price: vine.number().withoutDecimals().min(0).optional(),
})

export const eventProductUpdateValidator = vine.create({
  quantity: vine.number().withoutDecimals().min(1).optional(),
  price: vine.number().withoutDecimals().min(0).optional(),
})
