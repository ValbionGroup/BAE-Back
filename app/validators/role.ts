import vine from '@vinejs/vine'
import { PERMISSIONS } from '#database/rbac_catalog'

export const rolePermissionsValidator = vine.create({
  permissions: vine.array(vine.enum(PERMISSIONS)).distinct(),
})
