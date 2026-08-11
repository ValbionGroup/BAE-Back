import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Role from '#models/role'
import ApiException from '#exceptions/api_exception'
import { rolePermissionsValidator } from '#validators/role'
import { acquireRbacLock, assertNoLockout, snapshotAtRiskPermissions } from '#services/rbac_service'

export default class RolesController {
  async index({ serialize }: HttpContext) {
    const roles = await Role.query().preload('permissions')
    return serialize(roles)
  }

  async store({ request, serialize }: HttpContext) {
    const { name } = request.all()
    const role = await Role.create({ name })
    return serialize(role)
  }

  async show({ params, serialize }: HttpContext) {
    const role = await Role.findOrFail(params.id)
    return serialize(role)
  }

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

  async syncPermissions({ params, request, serialize }: HttpContext) {
    const { permissions } = await request.validateUsing(rolePermissionsValidator)
    const role = await Role.findOrFail(params.id)

    await db.transaction(async (trx) => {
      await acquireRbacLock(trx)
      const atRisk = await snapshotAtRiskPermissions(trx)

      role.useTransaction(trx)
      await role.related('permissions').sync(permissions)

      await assertNoLockout(trx, atRisk)
    })

    await role.load('permissions')
    return serialize(role)
  }

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
