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
  // Reading the request audit trail. Gated because logs identify who did what,
  // and carry response bodies for every non-auth route.
  'log:read',
  // Coordination of an evening. All three write the priority credit, so they
  // belong to the bureau, not to every authenticated member.
  // Running the stable-marriage matching: rewrites every unlocked assignment.
  'event:matching',
  // Closing an evening: consolidates the deltas into `members.points`, and no
  // route undoes it.
  'event:settle',
  // Creating, locking or deleting an assignment by hand.
  'assignment:write',
]

export default class extends BaseSeeder {
  async run() {
    await Permission.fetchOrCreateMany(
      'permission',
      permissions.map((permission) => ({ permission }))
    )
  }
}
