import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Client from '#models/client'
import { MemberFactory } from '#database/factories/members_factory'
import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'

/**
 * Le caissier renseigne son propre numéro : `PATCH /members/:id` exige
 * `member:write`, que la plupart des membres n'ont pas, et Lydia refuse
 * d'encaisser sans lui.
 */
test.group('Téléphone du membre — libre-service', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un membre enregistre son numéro, normalisé en E.164', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)

    const response = await client
      .put('/v1/account/phone')
      .json({ phone: '06 12 34 56 78' })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.phone, '+33612345678')

    await member.refresh()
    assert.equal(member.phone, '+33612345678')
  })

  test('un numéro invalide est refusé et n’écrit rien', async ({ client, assert }) => {
    const member = await MemberFactory.merge({ phone: '+33611111111' }).create()
    const user = await User.findOrFail(member.id)

    const response = await client.put('/v1/account/phone').json({ phone: '06 12' }).loginAs(user)

    response.assertStatus(422)
    await member.refresh()
    assert.equal(member.phone, '+33611111111', 'un refus ne doit rien écraser')
  })

  /** Lydia est un portefeuille mobile : un fixe n'y est rattaché à aucun compte. */
  test('un fixe est refusé', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)

    const response = await client
      .put('/v1/account/phone')
      .json({ phone: '01 42 34 56 78' })
      .loginAs(user)

    response.assertStatus(422)
  })

  test('null efface le numéro', async ({ client, assert }) => {
    const member = await MemberFactory.merge({ phone: '+33612345678' }).create()
    const user = await User.findOrFail(member.id)

    const response = await client.put('/v1/account/phone').json({ phone: null }).loginAs(user)

    response.assertStatus(200)
    await member.refresh()
    assert.isNull(member.phone)
  })

  /** La route vit derrière `audience('member')` : un client n'a pas de ligne où écrire. */
  test('un compte sans ligne membre est refusé', async ({ client }) => {
    const user = await UserFactory.create()
    await Client.create({ id: user.id, promotion: null, registeredAt: DateTime.now() })

    const response = await client
      .put('/v1/account/phone')
      .json({ phone: '0612345678' })
      .loginAs(user)

    response.assertStatus(403)
  })

  test('sans session, la route refuse', async ({ client }) => {
    const response = await client.put('/v1/account/phone').json({ phone: '0612345678' })

    response.assertStatus(401)
  })
})
