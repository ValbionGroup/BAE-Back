import vine from '@vinejs/vine'

// Delta, donc `optional()` partout : un PATCH ne portant que `phone` ne doit pas
// effacer la promotion. `nullable()` en plus sur les champs effaçables — `null`
// veut dire « vider », `undefined` « ne pas toucher ».
export const updateClientValidator = vine.create({
  phone: vine.string().trim().maxLength(32).nullable().optional(),
  promotion: vine.string().trim().maxLength(255).nullable().optional(),
  note: vine.string().trim().maxLength(2000).nullable().optional(),
})
