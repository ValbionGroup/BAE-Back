import vine from '@vinejs/vine'

/**
 * Validators for the coordination domain: jobs, event jobs and assignments.
 *
 * The wire sends snake_case; `case_converter_middleware` turns both the body
 * and the query string into camelCase before validation runs, so every schema
 * below is declared with camelCase keys.
 */

/**
 * Validator for creating or updating a job.
 */
export const jobValidator = vine.create({
  name: vine.string().trim().minLength(1),
  description: vine.string().trim().nullable().optional(),
  type: vine.enum(['before', 'during', 'after']).optional(),
})

/**
 * Validator for creating an event job (composite key + count).
 */
export const eventJobValidator = vine.create({
  eventId: vine.number().positive(),
  jobId: vine.number().positive(),
  count: vine.number().min(0),
})

/**
 * Validator for the `event_id` + `job_id` query params identifying an event job.
 */
export const eventJobKeyValidator = vine.create({
  eventId: vine.number().positive(),
  jobId: vine.number().positive(),
})

/**
 * Validator for the body of an event job update — the composite key travels in
 * the query string, only the count is sent in the body.
 */
export const eventJobCountValidator = vine.create({
  count: vine.number().min(0),
})

/**
 * Validator for an assignment, used both for the create body and for the
 * `member_id` + `event_id` + `job_id` query params of the delete and update.
 */
export const assignmentValidator = vine.create({
  memberId: vine.number().positive(),
  eventId: vine.number().positive(),
  jobId: vine.number().positive(),
  locked: vine.boolean().optional(),
})

/**
 * Validator for the body of an assignment update — the composite key travels in
 * the query string, only the mutable flag is sent in the body.
 *
 * `pointsDelta` is deliberately absent: it is bookkeeping owned by the matching
 * engine, which refunds it when replacing a row. Letting a client set it would
 * corrupt members' point totals on the next run.
 */
export const assignmentLockValidator = vine.create({
  locked: vine.boolean(),
})

/**
 * Validator for a job eligible member, used both for the create body and for
 * the `job_id` + `member_id` query params of the delete.
 */
export const jobEligibleMemberValidator = vine.create({
  jobId: vine.number().positive(),
  memberId: vine.number().positive(),
})

/**
 * Validator for a member setting their own job preferences.
 *
 * The list is ORDERED: rank is derived from position, so a client cannot submit
 * a ranking with gaps, ties or duplicates. An empty array clears the list.
 */
export const jobPreferencesValidator = vine.create({
  jobIds: vine.array(vine.number().positive()).distinct(),
})
