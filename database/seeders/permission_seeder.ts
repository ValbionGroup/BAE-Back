import { BaseSeeder } from '@adonisjs/lucid/seeders'
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

export default class extends BaseSeeder {
  async run() {
    await Permission.fetchOrCreateMany(
      'permission',
      permissions.map((permission) => ({ permission }))
    )
  }
}