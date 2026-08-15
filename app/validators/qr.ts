import vine from '@vinejs/vine'

export const qrVerifyValidator = vine.create({
  token: vine.string().trim().minLength(1),
})

export const buyerSearchValidator = vine.create({
  q: vine.string().trim().minLength(2),
})
