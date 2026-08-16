import vine from '@vinejs/vine'

export const ticketOpenValidator = vine.create({
  subject: vine.string().trim().minLength(3).maxLength(255),
  body: vine.string().trim().minLength(1),
  priority: vine.enum(['low', 'normal', 'high'] as const).optional(),
})

export const ticketStatusValidator = vine.create({
  status: vine.enum(['open', 'in_progress', 'closed'] as const),
})

export const ticketReplyValidator = vine.create({
  body: vine.string().trim().minLength(1),
})
