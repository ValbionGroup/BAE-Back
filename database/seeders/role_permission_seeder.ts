import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import Permission from '#models/permission'

export default class extends BaseSeeder {
  async run() {
    // Fetch all roles and permissions
    const roles = await Role.all()
    const permissions = await Permission.all()

    // Define permission mapping for different roles
    const rolePermissionMap: Record<string, string[]> = {
      President: [
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
        'log:read',
      ],
      Service: [
        'presence:read',
        'stock:read',
        'product:read',
        'supplier:read',
        'restock:read',
        'restock:create',
      ],
      Assembly: ['presence:read', 'stock:read', 'product:read'],
      Logistics: [
        'stock:read',
        'stock:update',
        'stock:create',
        'product:read',
        'supplier:read',
        'supplier:update',
        'restock:read',
        'restock:update',
        'restock:create',
      ],
      // Présidence and Trésorerie are the two admin scopes the app already
      // claims ("admin réservé Présidence + Trésorerie"), so they are the two
      // roles trusted with the audit trail.
      Finance: [
        'supplier:read',
        'supplier:update',
        'restock:read',
        'restock:update',
        'product:read',
        'log:read',
      ],
      HR: ['presence:write', 'presence:read'],
    }

    // Assign permissions to roles
    for (const role of roles) {
      const permissionNames = rolePermissionMap[role.name] || []
      const rolePermissions = permissions.filter((p) => permissionNames.includes(p.permission))

      if (rolePermissions.length > 0) {
        await role.related('permissions').attach(rolePermissions.map((p) => p.permission))
      }
    }
  }
}
