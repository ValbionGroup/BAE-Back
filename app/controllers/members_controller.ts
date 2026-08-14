import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Member from '#models/member'
import Role from '#models/role'
import User from '#models/user'
import ApiException from '#exceptions/api_exception'
import { updateMemberValidator } from '#validators/member'
import {
  acquireRbacLock,
  assertCanActOn,
  assertCanGrant,
  assertNoLockout,
  permissionsOfMember,
  permissionsOfRole,
  snapshotAtRiskPermissions,
} from '#services/rbac_service'

export default class MembersController {
  async index({ serialize }: HttpContext) {
    const members = await Member.query().preload('role')
    return serialize(members)
  }

  async store({ request, serialize }: HttpContext) {
    const { firstName, lastName } = request.all()
    const member = new Member()
    member.firstName = firstName
    member.lastName = lastName
    await member.save()
    return serialize(member)
  }

  async show({ params, serialize }: HttpContext) {
    const member = await Member.query().preload('role').where('id', params.id).first()
    if (!member) {
      throw new ApiException('E_MEMBER_NOT_FOUND', 'Membre introuvable.', 404)
    }
    return serialize(member)
  }

  async update({ params, request, auth, serialize }: HttpContext) {
    const payload = await request.validateUsing(updateMemberValidator)
    const actorId = auth.getUserOrFail().id
    const targetId = Number(params.id)

    await db.transaction(async (trx) => {
      await acquireRbacLock(trx)
      const atRisk = await snapshotAtRiskPermissions(trx)

      const member = await Member.query({ client: trx }).where('id', targetId).first()
      if (!member) {
        throw new ApiException('E_MEMBER_NOT_FOUND', 'Membre introuvable.', 404)
      }

      const actorPermissions = await permissionsOfMember(actorId, trx)
      assertCanActOn(actorPermissions, await permissionsOfMember(member.id, trx))

      if (payload.roleId !== undefined && payload.roleId !== member.roleId) {
        if (payload.roleId !== null) {
          const role = await Role.query({ client: trx }).where('id', payload.roleId).first()
          if (!role) {
            throw new ApiException('E_ROLE_NOT_FOUND', 'Rôle introuvable.', 404)
          }
          assertCanGrant(actorPermissions, await permissionsOfRole(payload.roleId, trx))
        }
        member.roleId = payload.roleId
      }

      if (payload.firstName !== undefined) member.firstName = payload.firstName
      if (payload.lastName !== undefined) member.lastName = payload.lastName

      member.useTransaction(trx)
      await member.save()

      await assertNoLockout(trx, atRisk)
    })

    const fresh = await Member.query().where('id', targetId).preload('role').firstOrFail()
    return serialize(fresh)
  }

  async destroy({ params, auth, response }: HttpContext) {
    const actorId = auth.getUserOrFail().id
    const targetId = Number(params.id)

    await db.transaction(async (trx) => {
      await acquireRbacLock(trx)
      const atRisk = await snapshotAtRiskPermissions(trx)

      const member = await Member.query({ client: trx }).where('id', targetId).first()
      if (!member) {
        throw new ApiException('E_MEMBER_NOT_FOUND', 'Membre introuvable.', 404)
      }

      if (member.id === actorId) {
        throw new ApiException(
          'E_MEMBER_SELF_DELETE',
          'Vous ne pouvez pas supprimer votre propre compte.',
          409
        )
      }

      assertCanActOn(
        await permissionsOfMember(actorId, trx),
        await permissionsOfMember(member.id, trx)
      )

      // Deletes the ACCOUNT, not just the `members` row: everything cascades from
      // `users`, and `ProfileController.show` dereferences `user.member` without
      // testing for null — an orphaned `users` would answer 500.
      const user = await User.query({ client: trx }).where('id', member.id).first()
      if (user) {
        user.useTransaction(trx)
        await user.delete()
      }

      await assertNoLockout(trx, atRisk)
    })

    return response.noContent()
  }
}
