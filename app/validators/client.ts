import vine from '@vinejs/vine'

export const createClientValidator = vine.create({
  email: vine.string().trim().email().maxLength(255),
  firstName: vine.string().trim().minLength(1).maxLength(255),
  lastName: vine.string().trim().minLength(1).maxLength(255),
  phone: vine.string().trim().maxLength(32).nullable().optional(),
  promotion: vine.string().trim().maxLength(255).nullable().optional(),
  registeredAt: vine.date({ formats: ['iso8601'] }).optional(),
})

// Delta, donc `optional()` partout : un PATCH ne portant que `phone` ne doit pas
// effacer la promotion. `nullable()` en plus sur les champs effaçables — `null`
// veut dire « vider », `undefined` « ne pas toucher ».
export const updateClientValidator = vine.create({
  firstName: vine.string().trim().minLength(1).maxLength(255).optional(),
  lastName: vine.string().trim().minLength(1).maxLength(255).optional(),
  phone: vine.string().trim().maxLength(32).nullable().optional(),
  promotion: vine.string().trim().maxLength(255).nullable().optional(),
  note: vine.string().trim().maxLength(2000).nullable().optional(),
})
