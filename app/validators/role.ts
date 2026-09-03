import vine from '@vinejs/vine'
import { PERMISSIONS } from '#database/rbac_catalog'

export const rolePermissionsValidator = vine.create({
  permissions: vine.array(vine.enum(PERMISSIONS)).distinct(),
})

/**
 * ⚠️ `name` est requis même sur un PATCH : `roles` ne porte que cette colonne, et
 * elle est `NOT NULL`. Une écriture qui la tairait n'aurait rien à dire.
 */
export const roleValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(255),
})
