import vine from '@vinejs/vine'
import { emailRule, strongPasswordRule } from '#validators/rules'

/**
 * Sans contrainte d'unicité : `member:create` traite elle-même le cas d'un compte
 * déjà là, qu'elle promeut au lieu de le refuser. Le mot de passe est optionnel —
 * un compte né du SSO n'en a pas.
 */
export const memberCreateValidator = vine.create({
  email: emailRule(),
  password: strongPasswordRule().optional(),
})

// The body is a delta, hence `optional()` throughout: without it a PATCH
// carrying only `roleId` would write `undefined` into both names. On `roleId`,
// `nullable()` AND `optional()` each count — `null` means "no role",
// `undefined` means "leave the role alone" — so the controller tests
// `!== undefined`, never truthiness.
export const updateMemberValidator = vine.create({
  firstName: vine.string().trim().minLength(1).maxLength(255).optional(),
  lastName: vine.string().trim().minLength(1).maxLength(255).optional(),
  roleId: vine.number().positive().nullable().optional(),
})
