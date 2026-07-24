import vine from '@vinejs/vine'

/**
 * Validator for setting the current member's availability on an event.
 * The wire sends `is_available`; case_converter_middleware turns it into
 * `isAvailable` before validation runs.
 */
export const availabilityValidator = vine.create({
  isAvailable: vine.boolean(),
})

/**
 * Validator for creating or updating an event.
 */
export const eventValidator = vine.create({
  name: vine.string().trim().minLength(1),
  date: vine.string(),
  duration: vine.number().positive().nullable().optional(),
  description: vine.string().nullable().optional(),
  status: vine.enum(['scheduled', 'ongoing', 'completed']).optional(),
})
