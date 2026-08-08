import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import ApiException from '#exceptions/api_exception'
import Role from '#models/role'
import Member from '#models/member'
import { rolePermissionsValidator } from '#validators/role'

/**
 * Arbitrary but fixed key for `pg_advisory_xact_lock`. Every caller that mutates
 * role permissions and then counts holders of a protected permission must take
 * this same lock first, or two concurrent syncs on DIFFERENT roles can each run
 * under READ COMMITTED without ever seeing the other's uncommitted delete — both
 * pass their headcount check, and the invariant they exist to enforce is lost.
 * The lock is transaction-scoped, so it releases itself on commit or rollback.
 */
const RBAC_LOCK_KEY = 872_364_501

/**
 * Permissions that must always survive a sync somewhere in the org: without
 * `role:write` nobody can fix a bad grant, and without `role:read` nobody can
 * even see the matrix (it also gates `/equipe`, `GET /roles`, `GET /permissions`,
 * and the sidebar entry) to find their way back. Losing either one is only
 * recoverable via direct database access.
 */
const RBAC_PROTECTED_PERMISSIONS = ['role:read', 'role:write'] as const

type ProtectedPermission = (typeof RBAC_PROTECTED_PERMISSIONS)[number]

export default class RolesController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    const roles = await Role.query().preload('permissions')
    return serialize(roles)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { name } = request.all()
    const role = await Role.create({ name })
    return serialize(role)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    const role = await Role.findOrFail(params.id)
    return serialize(role)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
    const { name } = request.body()
    const role = await Role.find(params.id)
    if (!role) {
      throw new Error('Role not found')
    }
    role.name = name
    await role.save()
    return serialize(role)
  }

  /**
   * Replace the permissions granted to a role.
   *
   * `sync` and not `attach`: the body carries the complete list, so the call is
   * idempotent and a permission dropped from the list is revoked in the same
   * request. Names travel on the wire because `Permission.primaryKey` is the
   * `permission` string itself — there is no id to resolve.
   */
  async syncPermissions({ params, request, serialize }: HttpContext) {
    const { permissions } = await request.validateUsing(rolePermissionsValidator)
    const role = await Role.findOrFail(params.id)

    await db.transaction(async (trx) => {
      // Pris avant le premier comptage : une requête concurrente sur un autre
      // rôle attend ici, puis mesure l'état réellement commité par celle-ci au
      // lieu d'un instantané périmé.
      await trx.rawQuery('SELECT pg_advisory_xact_lock(?)', [RBAC_LOCK_KEY])

      const countHolders = async (permission: ProtectedPermission) => {
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

      // Une permission que personne ne porte déjà n'est pas protégeable : la
      // défendre ici refuserait toute édition sans rendre l'accès à quiconque,
      // alors que réattribuer la permission est justement ce que l'appelant
      // vient faire. Seules comptent celles que CE sync ferait tomber à zéro.
      const atRisk: ProtectedPermission[] = []
      for (const permission of RBAC_PROTECTED_PERMISSIONS) {
        if ((await countHolders(permission)) > 0) {
          atRisk.push(permission)
        }
      }

      role.useTransaction(trx)
      await role.related('permissions').sync(permissions)

      // Recomptées APRÈS application, dans la transaction : la règle est exacte
      // par construction. Simuler l'état futur avant le sync donnerait deux
      // logiques à garder d'accord.
      for (const permission of atRisk) {
        if ((await countHolders(permission)) === 0) {
          throw new ApiException(
            'E_RBAC_LOCKOUT',
            `Accordez d’abord ${permission} à un rôle occupé avant de la retirer ici.`,
            409
          )
        }
      }
    })

    await role.load('permissions')
    return serialize(role)
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const role = await Role.find(params.id)
    if (!role) {
      throw new Error('Role not found')
    }
    await role.delete()
  }
}
