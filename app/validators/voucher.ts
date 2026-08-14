import vine from '@vinejs/vine'

/**
 * Validator for creating a voucher ("bon d'achat").
 *
 * The wire sends snake_case (`supplier_id`, `expires_at`, `used_at`);
 * case_converter_middleware turns it into camelCase before validation runs.
 *
 * `value` is accepted as a number even though the column is `decimal(10,2)`
 * (a string once it round-trips through `pg`) — the controller stringifies it
 * on the way in and re-numbers it on the way out.
 *
 * `expiresAt` / `usedAt` are ISO 8601 strings, parsed with Luxon in the
 * controller so an unparseable date is reported as a validation failure.
 */
export const voucherValidator = vine.create({
  supplierId: vine.number().positive().nullable().optional(),
  value: vine.number().positive(),
  expiresAt: vine.string().trim().minLength(1),
  condition: vine.string().trim().nullable().optional(),
  usedAt: vine.string().trim().nullable().optional(),
})

/**
 * Validator for updating a voucher. Every field is optional so the same route
 * serves PUT (full replace) and PATCH (partial update).
 */
export const voucherUpdateValidator = vine.create({
  supplierId: vine.number().positive().nullable().optional(),
  value: vine.number().positive().optional(),
  expiresAt: vine.string().trim().minLength(1).optional(),
  condition: vine.string().trim().nullable().optional(),
  usedAt: vine.string().trim().nullable().optional(),
})
