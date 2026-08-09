import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Role from '#models/role'
import ApiException from '#exceptions/api_exception'
import { rolePermissionsValidator } from '#validators/role'
import { acquireRbacLock, assertNoLockout, snapshotAtRiskPermissions } from '#services/rbac_service'

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
      throw new ApiException('E_ROLE_NOT_FOUND', 'Rôle introuvable.', 404)
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
      // Pris AVANT le sync, de sorte qu'une seconde requête concurrente sur un
      // autre rôle bloque ici jusqu'à notre commit ou rollback — elle recompte
      // alors contre l'état réel, pas contre un instantané périmé.
      await acquireRbacLock(trx)
      const atRisk = await snapshotAtRiskPermissions(trx)

      role.useTransaction(trx)
      await role.related('permissions').sync(permissions)

      await assertNoLockout(trx, atRisk)
    })

    await role.load('permissions')
    return serialize(role)
  }

  /**
   * Delete record
   *
   * `members.role_id` est `ON DELETE SET NULL` et `roles_permissions.role_id`
   * est `ON DELETE CASCADE` : supprimer le seul rôle porteur de `role:write`
   * détache tous ses membres ET emporte la ligne de permission avec lui, ce qui
   * fait tomber le compte global à zéro dans le même geste. Même enveloppe que
   * `syncPermissions` : verrou, instantané avant mutation, suppression sous
   * transaction, assertion après.
   */
  async destroy({ params, response }: HttpContext) {
    await db.transaction(async (trx) => {
      await acquireRbacLock(trx)
      const atRisk = await snapshotAtRiskPermissions(trx)

      const role = await Role.query({ client: trx }).where('id', params.id).first()
      if (!role) {
        throw new ApiException('E_ROLE_NOT_FOUND', 'Rôle introuvable.', 404)
      }

      role.useTransaction(trx)
      await role.delete()

      await assertNoLockout(trx, atRisk)
    })

    return response.noContent()
  }
}
