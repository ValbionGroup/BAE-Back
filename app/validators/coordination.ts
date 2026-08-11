import vine from '@vinejs/vine'

export const jobValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
  description: vine.string().trim().maxLength(255).nullable().optional(),
  type: vine.enum(['before', 'during', 'after']).optional(),
})

export const eventJobValidator = vine.create({
  eventId: vine.number().positive(),
  jobId: vine.number().positive(),
  count: vine.number().min(0),
})

export const eventJobKeyValidator = vine.create({
  eventId: vine.number().positive(),
  jobId: vine.number().positive(),
})

export const eventJobCountValidator = vine.create({
  count: vine.number().min(0),
})

export const assignmentValidator = vine.create({
  memberId: vine.number().positive(),
  eventId: vine.number().positive(),
  jobId: vine.number().positive(),
  locked: vine.boolean().optional(),
})

// `pointsDelta` is deliberately absent: it is bookkeeping owned by the matching
// engine, which refunds it when replacing a row. Letting a client set it would
// corrupt members' point totals.
export const assignmentLockValidator = vine.create({
  locked: vine.boolean(),
})

export const jobEligibleMemberValidator = vine.create({
  jobId: vine.number().positive(),
  memberId: vine.number().positive(),
})

export const jobPreferencesValidator = vine.create({
  jobIds: vine.array(vine.number().positive()).distinct(),
})
