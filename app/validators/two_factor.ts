import vine from '@vinejs/vine'

const totpCodeRule = () =>
  vine
    .string()
    .fixedLength(6)
    .regex(/^\d{6}$/)

export const twoFactorConfirmValidator = vine.create({
  code: totpCodeRule(),
})

export const twoFactorVerifyValidator = vine.create({
  code: totpCodeRule().optional(),
  recoveryCode: vine.string().minLength(10).maxLength(20).optional(),
})

export const twoFactorDisableValidator = vine.create({
  password: vine.string(),
})
