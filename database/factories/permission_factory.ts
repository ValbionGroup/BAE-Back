import factory from '@adonisjs/lucid/factories'
import Permission from '#models/permission'

const permissions = [
  'presence:write',
  'presence:read',
  'stock:read',
  'stock:update',
  'stock:create',
  'stock:delete',
  'product:read',
  'product:update',
  'product:create',
  'product:delete',
  'supplier:read',
  'supplier:update',
  'supplier:create',
  'supplier:delete',
  'restock:read',
  'restock:update',
  'restock:create',
  'restock:delete',
]

export const PermissionFactory = factory
  .define(Permission, async ({ index }) => {
    if (index >= permissions.length) {
      throw new Error('Plus de permissions disponibles (unicité garantie)')
    }

    return {
      permission: permissions[index],
    }
  })
  .build()
