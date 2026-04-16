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

// copie modifiable
let availablePermissions = [...permissions]

export const PermissionFactory = factory
  .define(Permission, async () => {
    if (availablePermissions.length === 0) {
      throw new Error('Plus de permissions disponibles (unicité garantie)')
    }

    const value = availablePermissions.shift()!

    return {
      permission: value,
    }
  })
  .build()