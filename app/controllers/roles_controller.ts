import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import Role from '#models/role'
import Member from '#models/member'
import { rolePermissionsValidator } from '#validators/role'

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
      role.useTransaction(trx)
      await role.related('permissions').sync(permissions)

      // Vérifié APRÈS application, dans la transaction : une seule règle, exacte
      // par construction. Simuler l'état futur avant le sync donnerait deux
      // logiques à garder d'accord.
      const holders = await Member.query({ client: trx })
        .whereHas('role', (roleQuery) =>
          roleQuery.whereHas('permissions', (permissionQuery) =>
            permissionQuery.where('permission', 'role:write')
          )
        )
        .count('* as total')

      // `count` revient en string du driver Postgres : sans `Number`, la
      // comparaison est toujours fausse et l'invariant ne protège rien.
      if (Number(holders[0].$extras.total) === 0) {
        throw new Exception(
          'Accordez d’abord role:write à un rôle occupé avant de la retirer ici.',
          { code: 'E_RBAC_LOCKOUT', status: 409 }
        )
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
