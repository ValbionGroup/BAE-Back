import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Client from '#models/client'
import FastPass from '#models/fast_pass'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

async function makeClient(email: string): Promise<Client> {
  const user = await User.create({
    email,
    password: 'secret-de-test',
    firstName: 'Camille',
    lastName: 'Renard',
  })
  return Client.create({ id: user.id, phone: null, promotion: null, registeredAt: DateTime.now() })
}

test.group('Cotisations', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('refuses a member without subscription:write', async ({ client: httpClient }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['client:read'])
    const person = await makeClient('a@test.fr')
    const formula = await FastPass.create({
      label: 'Année',
      price: 15,
      duration: 365,
      description: null,
    })

    const response = await httpClient
      .post('/v1/subscriptions')
      .json({ userId: person.id, fastPassId: formula.id })
      .loginAs(user)
    response.assertStatus(403)
  })

  test('a renewal adds a row instead of replacing the previous one', async ({
    client: httpClient,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['subscription:write'])
    const person = await makeClient('b@test.fr')
    const formula = await FastPass.create({
      label: 'Année',
      price: 15,
      duration: 365,
      description: null,
    })

    const first = await httpClient
      .post('/v1/subscriptions')
      .json({
        userId: person.id,
        fastPassId: formula.id,
        subscribedAt: '2024-10-03T00:00:00.000Z',
      })
      .loginAs(user)
    first.assertStatus(200)

    const second = await httpClient
      .post('/v1/subscriptions')
      .json({
        userId: person.id,
        fastPassId: formula.id,
        subscribedAt: '2025-09-12T00:00:00.000Z',
      })
      .loginAs(user)
    second.assertStatus(200)

    const rows = await db.from('subscriptions').where('user_id', person.id)
    assert.lengthOf(rows, 2, "un renouvellement n'écrase jamais l'historique")
  })

  test('refuses the very same subscription twice', async ({ client: httpClient }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['subscription:write'])
    const person = await makeClient('c@test.fr')
    const formula = await FastPass.create({
      label: 'Année',
      price: 15,
      duration: 365,
      description: null,
    })

    const body = {
      userId: person.id,
      fastPassId: formula.id,
      subscribedAt: '2025-09-12T00:00:00.000Z',
    }
    await httpClient.post('/v1/subscriptions').json(body).loginAs(user)
    const duplicate = await httpClient.post('/v1/subscriptions').json(body).loginAs(user)
    duplicate.assertStatus(409)
  })

  test('the recorded amount is the one paid, not the current price', async ({
    client: httpClient,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['subscription:write', 'client:read'])
    const person = await makeClient('d@test.fr')
    const formula = await FastPass.create({
      label: 'Année',
      price: 15,
      duration: 365,
      description: null,
    })

    await httpClient
      .post('/v1/subscriptions')
      .json({
        userId: person.id,
        fastPassId: formula.id,
        subscribedAt: '2023-09-21T00:00:00.000Z',
        payment: { amount: 12, type: 'lydia' },
      })
      .loginAs(user)

    // Le tarif augmente APRÈS la souscription.
    formula.price = 15
    await formula.save()

    const detail = await httpClient.get(`/v1/clients/${person.id}`).loginAs(user)
    const body = (
      detail.body() as {
        data: { subscriptions: { amount: number | null; payment_method: string | null }[] }
      }
    ).data

    assert.equal(body.subscriptions[0].amount, 12, 'le montant historique ne bouge pas')
    assert.equal(body.subscriptions[0].payment_method, 'lydia')
  })

  test('a subscription without payment carries no amount rather than a made-up one', async ({
    client: httpClient,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['subscription:write', 'client:read'])
    const person = await makeClient('e@test.fr')
    const formula = await FastPass.create({
      label: 'Année',
      price: 15,
      duration: 365,
      description: null,
    })

    await httpClient
      .post('/v1/subscriptions')
      .json({ userId: person.id, fastPassId: formula.id })
      .loginAs(user)

    const detail = await httpClient.get(`/v1/clients/${person.id}`).loginAs(user)
    const body = (detail.body() as { data: { subscriptions: { amount: number | null }[] } }).data
    assert.isNull(body.subscriptions[0].amount)
  })

  test('refuses to subscribe someone who is not a client', async ({ client: httpClient }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['subscription:write'])
    const formula = await FastPass.create({
      label: 'Année',
      price: 15,
      duration: 365,
      description: null,
    })

    const response = await httpClient
      .post('/v1/subscriptions')
      .json({ userId: member.id, fastPassId: formula.id })
      .loginAs(user)
    response.assertStatus(404)
  })

  test('deleting requires the date, which is part of the key', async ({
    client: httpClient,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['subscription:write', 'subscription:delete'])
    const person = await makeClient('f@test.fr')
    const formula = await FastPass.create({
      label: 'Année',
      price: 15,
      duration: 365,
      description: null,
    })

    await httpClient
      .post('/v1/subscriptions')
      .json({
        userId: person.id,
        fastPassId: formula.id,
        subscribedAt: '2025-09-12T00:00:00.000Z',
      })
      .loginAs(user)

    const withoutDate = await httpClient
      .delete(`/v1/subscriptions/${person.id}/${formula.id}`)
      .loginAs(user)
    withoutDate.assertStatus(422)

    const withDate = await httpClient
      .delete(`/v1/subscriptions/${person.id}/${formula.id}`)
      .qs({ subscribedAt: '2025-09-12T00:00:00.000Z' })
      .loginAs(user)
    withDate.assertStatus(204)

    assert.lengthOf(await db.from('subscriptions').where('user_id', person.id), 0)
  })
})
