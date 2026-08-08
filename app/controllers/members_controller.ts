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
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    const members = await Member.query().preload('role')
    return serialize(members)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { firstName, lastName } = request.all()
    const member = new Member()
    member.firstName = firstName
    member.lastName = lastName
    await member.save()
    return serialize(member)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    const member = await Member.query().preload('role').where('id', params.id).first()
    if (!member) {
      // `ApiException` et non `new Error` : le gestionnaire ne traite spécialement
      // que la première. Une `Error` nue n'a même pas de statut et sort en 500
      // franc, là où le client attend un 404 — et le front ne peut alors rien
      // formuler d'utile.
      throw new ApiException('E_MEMBER_NOT_FOUND', 'Membre introuvable.', 404)
    }
    return serialize(member)
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, auth, serialize }: HttpContext) {
    const payload = await request.validateUsing(updateMemberValidator)
    const actorId = auth.getUserOrFail().id
    const targetId = Number(params.id)

    await db.transaction(async (trx) => {
      // Pris avant toute lecture : le comptage final ne vaut que si un écrivain
      // concurrent attend son tour. L'instantané suit immédiatement — il doit
      // précéder la mutation, sans quoi il ne mesure plus l'état d'avant.
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

      // `!== undefined` et non un test de vérité : le validator distingue
      // « champ absent » de « champ fourni », et seul le second doit écrire.
      if (payload.firstName !== undefined) member.firstName = payload.firstName
      if (payload.lastName !== undefined) member.lastName = payload.lastName

      member.useTransaction(trx)
      await member.save()

      await assertNoLockout(trx, atRisk)
    })

    // Rechargé APRÈS la transaction, et non via le modèle muté : `update`
    // préchargeait `role` avant le `save()`, donc un changement de `roleId`
    // renvoyait l'ancien rôle. Recharger sur le modèle lié à la transaction
    // committée lèverait « Transaction is already committed » — d'où une requête
    // neuve.
    const fresh = await Member.query().where('id', targetId).preload('role').firstOrFail()
    return serialize(fresh)
  }

  /**
   * Delete record
   *
   * Supprime le COMPTE, pas seulement la ligne `members` : un `users` sans
   * `members` n'a aujourd'hui aucun usage légitime (la table `clients` du §4.4
   * n'existe pas), et `ProfileController.show` déréférence `user.member` sans
   * tester sa nullité — la personne recevrait un 500 au démarrage du dashboard
   * au lieu d'un refus propre.
   *
   * Tout cascade depuis `users` : `members`, `auth_access_tokens` (la session
   * meurt avec le compte), puis depuis `members` les préférences, réponses,
   * affectations et éligibilités. `orders.member_id`, `restocks.member_id` et
   * `logs.user_id` passent en `SET NULL` — l'historique de caisse et le journal
   * d'audit survivent sans leur auteur.
   */
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

      // Avant la règle 1, qui passerait trivialement sur soi-même : le geste
      // détruit sa propre session au milieu de la requête.
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
