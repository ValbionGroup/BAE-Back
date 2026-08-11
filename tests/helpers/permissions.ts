import type Member from '#models/member'
import Permission from '#models/permission'
import Role from '#models/role'
import User from '#models/user'

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

export const COORDINATION_PERMISSIONS = ['event:matching', 'event:settle', 'assignment:write']

export function asCoordinator(member: Member): Promise<User> {
  return grantPermissions(member, COORDINATION_PERMISSIONS)
}
