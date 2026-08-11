import vine from '@vinejs/vine'

export const availabilityValidator = vine.create({
  isAvailable: vine.boolean(),
})

export const eventValidator = vine.create({
  name: vine.string().trim().minLength(1),
  date: vine.string(),
  duration: vine.number().positive().nullable().optional(),
  description: vine.string().nullable().optional(),
  status: vine.enum(['scheduled', 'ongoing', 'completed']).optional(),
})
