import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import ApiException from '#exceptions/api_exception'
import Member from '#models/member'
import Role from '#models/role'

const RBAC_LOCK_KEY = 872_364_501

// Under READ COMMITTED, two concurrent mutations on DIFFERENT rows never see
// each other's uncommitted change: both pass their headcount check and the
// invariant is lost. Every writer that recounts holders must take this lock
// first.

// Without `role:write` nobody can fix a bad grant, without `role:read` nobody
// can even see the matrix: losing either is only recoverable through the
// console. `member:write` is not here because a `role:write` holder can grant it
// back.
const RBAC_PROTECTED_PERMISSIONS = ['role:read', 'role:write'] as const

export type ProtectedPermission = (typeof RBAC_PROTECTED_PERMISSIONS)[number]

export async function acquireRbacLock(trx: TransactionClientContract): Promise<void> {
  await trx.rawQuery('SELECT pg_advisory_xact_lock(?)', [RBAC_LOCK_KEY])
}

async function countHolders(
  trx: TransactionClientContract,
  permission: ProtectedPermission
): Promise<number> {
  const holders = await Member.query({ client: trx })
    .whereHas('role', (roleQuery) =>
      roleQuery.whereHas('permissions', (permissionQuery) =>
        permissionQuery.where('permission', permission)
      )
    )
    .count('* as total')

  return Number(holders[0].$extras.total)
}

// Taken BEFORE the mutation, under the lock: a permission nobody already holds
// is not protectable, otherwise a `role:read` fallen to zero would fail every
// later edit with a 409 — including the one that would repair it.
export async function snapshotAtRiskPermissions(
  trx: TransactionClientContract
): Promise<ProtectedPermission[]> {
  const atRisk: ProtectedPermission[] = []
  for (const permission of RBAC_PROTECTED_PERMISSIONS) {
    if ((await countHolders(trx, permission)) > 0) {
      atRisk.push(permission)
    }
  }
  return atRisk
}

export async function assertNoLockout(
  trx: TransactionClientContract,
  atRisk: readonly ProtectedPermission[]
): Promise<void> {
  for (const permission of atRisk) {
    if ((await countHolders(trx, permission)) === 0) {
      throw new ApiException(
        'E_RBAC_LOCKOUT',
        `Accordez d’abord ${permission} à un rôle occupé avant de la retirer ici.`,
        409
      )
    }
  }
}

export async function permissionsOfMember(
  memberId: number,
  client?: TransactionClientContract
): Promise<Set<string>> {
  const member = await Member.query(client ? { client } : {})
    .where('id', memberId)
    .preload('role', (roleQuery) => roleQuery.preload('permissions'))
    .first()

  return new Set(member?.role?.permissions.map((entry) => entry.permission) ?? [])
}

export async function permissionsOfRole(
  roleId: number,
  client?: TransactionClientContract
): Promise<Set<string>> {
  const role = await Role.query(client ? { client } : {})
    .where('id', roleId)
    .preload('permissions')
    .first()

  return new Set(role?.permissions.map((entry) => entry.permission) ?? [])
}

function beyond(actor: Set<string>, other: Set<string>): string[] {
  return [...other].filter((permission) => !actor.has(permission)).sort()
}

export function assertCanActOn(actor: Set<string>, target: Set<string>): void {
  const missing = beyond(actor, target)
  if (missing.length > 0) {
    throw new ApiException(
      'E_RBAC_ABOVE_ACTOR',
      `Ce membre porte des permissions que vous n’avez pas : ${missing.join(', ')}.`,
      403
    )
  }
}

// Closes self-promotion: without it, a `member:write` holder points their own
// `roleId` at a role carrying `role:write`, never touching anybody else.
export function assertCanGrant(actor: Set<string>, role: Set<string>): void {
  const missing = beyond(actor, role)
  if (missing.length > 0) {
    throw new ApiException(
      'E_RBAC_ABOVE_ACTOR',
      `Ce rôle accorde des permissions que vous n’avez pas : ${missing.join(', ')}.`,
      403
    )
  }
}
