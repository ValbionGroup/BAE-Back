import vine from '@vinejs/vine'

export const voucherValidator = vine.create({
  supplierId: vine.number().positive().nullable().optional(),
  value: vine.number().withoutDecimals().positive(),
  expiresAt: vine.string().trim().minLength(1),
  condition: vine.string().trim().nullable().optional(),
  usedAt: vine.string().trim().nullable().optional(),
})

export const voucherUpdateValidator = vine.create({
  supplierId: vine.number().positive().nullable().optional(),
  value: vine.number().withoutDecimals().positive().optional(),
  expiresAt: vine.string().trim().minLength(1).optional(),
  condition: vine.string().trim().nullable().optional(),
  usedAt: vine.string().trim().nullable().optional(),
})
