import vine from '@vinejs/vine'
import { PERMISSIONS } from '#database/rbac_catalog'

/**
 * Validator for the body of `PUT /v1/roles/:id/permissions`.
 *
 * The enum is the RBAC catalog itself. A permission accepted here but named by
 * no `middleware.can()` would be a row that guards nothing — and `PermissionName`
 * exists precisely so that such a name fails the typecheck rather than reaching
 * the database.
 *
 * The list is complete, not a delta: what is absent is revoked.
 */
export const rolePermissionsValidator = vine.create({
  permissions: vine.array(vine.enum(PERMISSIONS)).distinct(),
})
