import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import Role from '#models/role'
import Permission from '#models/permission'

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
    const body = response.body() as { error: { code: string } }
    assert.equal(body.error.code, 'E_RBAC_ABOVE_ACTOR')

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
    const body = response.body() as { error: { code: string } }
    assert.equal(body.error.code, 'E_RBAC_ABOVE_ACTOR')
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
})
