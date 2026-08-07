import type Member from '#models/member'
import Permission from '#models/permission'
import Role from '#models/role'
import User from '#models/user'

/**
 * Test helper: hand a member a throwaway role carrying the given permissions,
 * and return the user to log in as.
 *
 * The coordination routes (matching, settle, assignment writes) all write
 * credit, so they are gated. Most specs of this branch are not about
 * authorisation at all — they just need a caller who is allowed through, hence
 * this one-liner rather than the same six lines repeated everywhere.
 */
export async function grantPermissions(member: Member, permissions: string[]): Promise<User> {
  const role = await Role.create({ name: `test-${member.id}` })

  for (const permission of permissions) {
    const row = await Permission.firstOrCreate({ permission }, { permission })
    await role.related('permissions').attach([row.permission])
  }

  member.roleId = role.id
  await member.save()

  return User.findOrFail(member.id)
}

/** Everything the coordination flow needs: run the matching, close the evening,
 *  write assignments by hand. */
export const COORDINATION_PERMISSIONS = ['event:matching', 'event:settle', 'assignment:write']

export function asCoordinator(member: Member): Promise<User> {
  return grantPermissions(member, COORDINATION_PERMISSIONS)
}
