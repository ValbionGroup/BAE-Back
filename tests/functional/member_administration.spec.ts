import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import Role from '#models/role'
import Permission from '#models/permission'
import db from '@adonisjs/lucid/services/db'
import Member from '#models/member'
import User from '#models/user'

test.group('Member administration', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('PATCH on an unknown member answers 404, not 500', async ({ client, assert }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])

    const response = await client.patch('/v1/members/999999').json({ firstName: 'X' }).loginAs(user)

    response.assertStatus(404)
    const body = response.body() as { error: { code: string; message: string } }
    assert.equal(body.error.code, 'E_MEMBER_NOT_FOUND')
    assert.equal(body.error.message, 'Membre introuvable.')
  })

  test('DELETE on an unknown member answers 404, not 500', async ({ client, assert }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])

    const response = await client.delete('/v1/members/999999').loginAs(user)

    response.assertStatus(404)
    const body = response.body() as { error: { code: string; message: string } }
    assert.equal(body.error.code, 'E_MEMBER_NOT_FOUND')
    assert.equal(body.error.message, 'Membre introuvable.')
  })

  test('a partial PATCH leaves the fields it does not carry alone', async ({ client, assert }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])
    const target = await MemberFactory.merge({ firstName: 'Ada', lastName: 'Lovelace' }).create()

    const response = await client
      .patch(`/v1/members/${target.id}`)
      .json({ roleId: null })
      .loginAs(user)

    response.assertStatus(200)
    await target.refresh()
    assert.equal(target.firstName, 'Ada', 'un corps partiel ne doit rien effacer')
    assert.equal(target.lastName, 'Lovelace')
  })

  test('the response carries the NEW role, not the preloaded stale one', async ({
    client,
    assert,
  }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])
    const target = await MemberFactory.create()
    const destination = await Role.create({ name: 'Pole Destination' })

    const response = await client
      .patch(`/v1/members/${target.id}`)
      .json({ roleId: destination.id })
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body() as { data: { role: { name: string } | null } }
    assert.equal(
      body.data.role?.name,
      'Pole Destination',
      'le preload a lieu avant le save : sans rechargement la réponse renvoie l’ancien rôle'
    )
  })

  test('refuses to grant a role carrying permissions the actor lacks', async ({
    client,
    assert,
  }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])
    const target = await MemberFactory.create()

    await Permission.firstOrCreate({ permission: 'role:write' })
    const admin = await Role.create({ name: 'Pole Admin' })
    await admin.related('permissions').sync(['role:write'])

    const response = await client
      .patch(`/v1/members/${target.id}`)
      .json({ roleId: admin.id })
      .loginAs(user)

    response.assertStatus(403)
    const body = response.body() as { error: { code: string; message: string } }
    assert.equal(body.error.code, 'E_RBAC_ABOVE_ACTOR')
    assert.equal(
      body.error.message,
      'Ce rôle accorde des permissions que vous n’avez pas : role:write.'
    )

    await target.refresh()
    assert.notEqual(target.roleId, admin.id, 'un refus ne doit rien écrire')
  })

  test('refuses to modify a member holding permissions the actor lacks', async ({
    client,
    assert,
  }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])

    const target = await MemberFactory.create()
    await grantPermissions(target, ['member:write', 'role:write'])

    const response = await client
      .patch(`/v1/members/${target.id}`)
      .json({ firstName: 'Renommé' })
      .loginAs(user)

    response.assertStatus(403)
    const body = response.body() as { error: { code: string; message: string } }
    assert.equal(body.error.code, 'E_RBAC_ABOVE_ACTOR')
    assert.equal(
      body.error.message,
      'Ce membre porte des permissions que vous n’avez pas : role:write.'
    )
  })

  test('refuses self-promotion: an actor cannot grant themselves a role above their own', async ({
    client,
    assert,
  }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])
    const ownRoleId = actor.roleId

    await Permission.firstOrCreate({ permission: 'role:write' })
    const admin = await Role.create({ name: 'Pole Auto Promo' })
    await admin.related('permissions').sync(['role:write'])

    const response = await client
      .patch(`/v1/members/${actor.id}`)
      .json({ roleId: admin.id })
      .loginAs(user)

    response.assertStatus(403)
    const body = response.body() as { error: { code: string } }
    assert.equal(body.error.code, 'E_RBAC_ABOVE_ACTOR')

    await actor.refresh()
    assert.equal(
      actor.roleId,
      ownRoleId,
      'la règle 2 ne fait aucun cas particulier de soi-même : se promouvoir est le trou qu’elle ferme'
    )
  })

  test('lets two members holding the SAME set manage each other', async ({ client, assert }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])

    const peer = await MemberFactory.create()
    await grantPermissions(peer, ['member:write'])

    const response = await client
      .patch(`/v1/members/${peer.id}`)
      .json({ firstName: 'Pair' })
      .loginAs(user)

    response.assertStatus(200)
    await peer.refresh()
    assert.equal(peer.firstName, 'Pair', 'l’inclusion est large : un pair gère son pair')
  })

  test('deleting a member deletes the user account and its sessions', async ({
    client,
    assert,
  }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])
    const target = await MemberFactory.create()
    const targetUser = await User.findOrFail(target.id)
    await User.accessTokens.create(targetUser)

    const response = await client.delete(`/v1/members/${target.id}`).loginAs(user)

    response.assertStatus(204)
    assert.isNull(await Member.find(target.id), 'la ligne members doit disparaître')
    assert.isNull(await User.find(target.id), 'le compte utilisateur part avec')

    const tokens = await db
      .from('auth_access_tokens')
      .where('tokenable_id', target.id)
      .count('* as total')
    assert.equal(Number(tokens[0].total), 0, 'les sessions cascadent depuis users')
  })

  test('refuses to delete oneself', async ({ client, assert }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])

    const response = await client.delete(`/v1/members/${actor.id}`).loginAs(user)

    response.assertStatus(409)
    const body = response.body() as { error: { code: string; message: string } }
    assert.equal(body.error.code, 'E_MEMBER_SELF_DELETE')
    assert.equal(body.error.message, 'Vous ne pouvez pas supprimer votre propre compte.')
    assert.isNotNull(await Member.find(actor.id))
  })

  test('refuses to delete a member holding permissions the actor lacks', async ({
    client,
    assert,
  }) => {
    const actor = await MemberFactory.create()
    const user = await grantPermissions(actor, ['member:write'])

    const target = await MemberFactory.create()
    await grantPermissions(target, ['member:write', 'role:write'])

    const response = await client.delete(`/v1/members/${target.id}`).loginAs(user)

    response.assertStatus(403)
    const body = response.body() as { error: { code: string; message: string } }
    assert.equal(body.error.code, 'E_RBAC_ABOVE_ACTOR')
    assert.equal(
      body.error.message,
      'Ce membre porte des permissions que vous n’avez pas : role:write.'
    )
    assert.isNotNull(await Member.find(target.id), 'un refus ne doit rien supprimer')
  })

  test('a peer sharing the protected role can still be deleted', async ({ client, assert }) => {
    // La base peut déjà contenir d'autres porteurs (comptes réels en dev, rôles
    // seedés) : sans les neutraliser, le décompte ne prouve rien.
    await db.from('roles_permissions').where('permission_id', 'role:write').delete()
    await db.from('roles_permissions').where('permission_id', 'role:read').delete()

    const held = ['member:write', 'role:read', 'role:write']
    for (const permission of held) {
      await Permission.firstOrCreate({ permission })
    }
    const protectedRole = await Role.create({ name: 'Pole Protege' })
    await protectedRole.related('permissions').sync(held)

    const actor = await MemberFactory.merge({ roleId: protectedRole.id }).create()
    const target = await MemberFactory.merge({ roleId: protectedRole.id }).create()
    const user = await User.findOrFail(actor.id)

    const response = await client.delete(`/v1/members/${target.id}`).loginAs(user)

    // L'acteur occupe encore le rôle protégé : la permission garde un porteur,
    // la suppression est légitime et l'invariant n'a pas à s'y opposer.
    response.assertStatus(204)
    assert.isNull(await Member.find(target.id))
  })
})
