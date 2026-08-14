import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import ApiException from '#exceptions/api_exception'
import Member from '#models/member'
import Role from '#models/role'

/**
 * Arbitrary but fixed key for `pg_advisory_xact_lock`. Every caller that mutates
 * role assignments or role permissions and then counts holders of a protected
 * permission must take this same lock first, or two concurrent writes on
 * DIFFERENT rows can each run under READ COMMITTED without ever seeing the
 * other's uncommitted change — both pass their headcount check, and the
 * invariant they exist to enforce is lost. Transaction-scoped: it releases
 * itself on commit or rollback.
 */
const RBAC_LOCK_KEY = 872_364_501

/**
 * Permissions that must always survive somewhere in the org: without
 * `role:write` nobody can fix a bad grant, and without `role:read` nobody can
 * even see the matrix (it also gates `/equipe`, `GET /roles`, `GET /permissions`
 * and the sidebar entry) to find their way back. Losing either is only
 * recoverable through the console.
 *
 * `member:write` is deliberately NOT here: losing it is recoverable — anyone
 * holding `role:write` can grant it back. Only these two self-lock, and that is
 * what defines the list.
 */
const RBAC_PROTECTED_PERMISSIONS = ['role:read', 'role:write'] as const

export type ProtectedPermission = (typeof RBAC_PROTECTED_PERMISSIONS)[number]

/** Take BEFORE mutating, so a concurrent writer blocks until we commit. */
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

  // `count` revient en string du driver Postgres : sans `Number`, la
  // comparaison est toujours fausse et l'invariant ne protège rien.
  return Number(holders[0].$extras.total)
}

/**
 * Instantané pris AVANT la mutation, sous le verrou : la liste des permissions
 * protégées qui ont encore des porteurs.
 *
 * Une permission que personne ne porte déjà n'est pas protégeable : la défendre
 * refuserait toute édition sans rendre l'accès à quiconque, alors que la
 * réattribuer est précisément ce que l'appelant vient faire. Seules comptent
 * celles que CETTE mutation ferait tomber à zéro.
 *
 * Sans ce filtre, un `role:read` tombé à zéro pour n'importe quelle raison
 * ferait échouer en 409 toute édition ultérieure, sur n'importe quel rôle,
 * définitivement — le seul endpoint capable de réparer étant celui qui refuse.
 */
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

/**
 * Recompté APRÈS application, dans la transaction : la règle est exacte par
 * construction. Simuler l'état futur avant la mutation donnerait deux logiques
 * à garder d'accord.
 *
 * `atRisk` vient de `snapshotAtRiskPermissions`, appelé avant la mutation.
 */
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

/** Ensemble effectif d'un membre. Vide s'il n'a pas de rôle, ou n'existe pas. */
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

/** Ensemble accordé par un rôle. Vide s'il n'accorde rien, ou n'existe pas. */
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

/**
 * Règle 1 — on n'agit pas sur plus haut que soi.
 *
 * `roles` ne porte ni rang ni notion d'« admin » : la hiérarchie est dérivée des
 * ensembles de permissions, seule source qui ne peut pas diverger du réel.
 * Comparer par `role.name` ferait une hiérarchie par chaîne de caractères, que
 * renommer un rôle casserait en silence.
 *
 * Inclusion LARGE : deux porteurs du même ensemble se gèrent mutuellement.
 * L'inclusion stricte rendrait le sommet intouchable depuis l'interface par
 * construction, pas seulement quand il est occupé seul.
 */
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

/**
 * Règle 2 — on n'accorde pas plus haut que soi.
 *
 * C'est elle qui ferme le trou réel : sans elle, un porteur de `member:write`
 * met `roleId` = un rôle qui porte `role:write` SUR SA PROPRE LIGNE et se
 * promeut. Il n'a jamais besoin de toucher à quelqu'un d'autre.
 *
 * La hiérarchie dérivée ne contraint que STRICTEMENT en dessous de
 * `role:write` : un porteur de `role:write` peut faire un `PUT
 * /v1/roles/<son propre rôle>/permissions` avec tout le catalogue en un seul
 * appel — `role:write` est racine par construction, cette règle ne le retient
 * pas lui-même.
 */
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
