import vine from '@vinejs/vine'

/**
 * Delta : `undefined` ne touche pas, `null` efface. Ni `note` (elle est au bureau), ni
 * `promotion`/`school` (claims SSO, écrasés au prochain login).
 */
export const updateProfileValidator = vine.create({
  phone: vine.string().trim().maxLength(32).nullable().optional(),
  telegramHandle: vine
    .string()
    .trim()
    .regex(/^(@?[A-Za-z][A-Za-z0-9_]{4,31})?$/)
    .nullable()
    .optional(),
  preparationNote: vine.string().trim().maxLength(500).nullable().optional(),
})
