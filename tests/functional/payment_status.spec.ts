import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import ace from '@adonisjs/core/services/ace'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import Client from '#models/client'
import Payment from '#models/payment'
import User from '#models/user'
import LydiaExpire from '../../commands/lydia_expire.js'

async function makeClient(email: string): Promise<User> {
  const user = await User.create({
    email,
    password: 'secret-de-test',
    casId: `cas-${email}`,
    firstName: 'Camille',
    lastName: 'Renard',
  })
  await Client.create({ id: user.id, promotion: null, registeredAt: DateTime.now() })
  return user
}

function makePayment(userId: number, orderRef: string, expiresAt: DateTime): Promise<Payment> {
  return Payment.create({
    provider: 'lydia',
    status: 'pending',
    orderRef,
    amountCents: 1500,
    currency: 'EUR',
    userId,
    kind: 'subscription',
    intent: '{}',
    expiresAt,
  })
}

test.group('État d’un paiement', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('le propriétaire lit l’état de sa demande', async ({ client: httpClient, assert }) => {
    const user = await makeClient('a@test.fr')
    await makePayment(user.id, 'ref-a', DateTime.now().plus({ minutes: 15 }))

    const response = await httpClient.get('/v1/account/payments/ref-a').loginAs(user)

    response.assertStatus(200)
    const body = response.body() as { data: { status: string; amount_cents: number } }
    assert.equal(body.data.status, 'pending')
    assert.equal(body.data.amount_cents, 1500)
  })

  /**
   * Le défaut visé : une référence suffisant à lire le paiement d'un autre. Elle
   * voyage dans une URL, donc dans des journaux et des historiques.
   */
  test('la demande d’un autre est introuvable', async ({ client: httpClient }) => {
    const owner = await makeClient('b@test.fr')
    const intruder = await makeClient('c@test.fr')
    await makePayment(owner.id, 'ref-b', DateTime.now().plus({ minutes: 15 }))

    const response = await httpClient.get('/v1/account/payments/ref-b').loginAs(intruder)
    response.assertStatus(404)
  })

  /**
   * Le défaut visé : consulter l'état ne doit rien confirmer. Seul le webhook
   * crée une contrepartie — sinon un simple GET vaudrait paiement, et le retour
   * navigateur suffirait à obtenir la marchandise.
   */
  test('consulter l’état ne confirme rien', async ({ client: httpClient, assert }) => {
    const user = await makeClient('d@test.fr')
    await makePayment(user.id, 'ref-d', DateTime.now().plus({ minutes: 15 }))
    const before = await db.from('transactions').max('id as max').first()

    await httpClient.get('/v1/account/payments/ref-d').loginAs(user)

    const created = await db.from('transactions').where('id', '>', Number(before?.max ?? 0))
    assert.lengthOf(created, 0)

    const payment = await Payment.findByOrFail('orderRef', 'ref-d')
    assert.equal(payment.status, 'pending')
  })

  /**
   * Le défaut visé : des `pending` éternels, qui rendent le rapprochement
   * illisible et empêchent de distinguer l'abandonné de l'en-cours.
   */
  test('une demande dépassée devient expirée, une demande en cours non', async ({ assert }) => {
    const user = await makeClient('e@test.fr')
    await makePayment(user.id, 'ref-old', DateTime.now().minus({ minutes: 1 }))
    await makePayment(user.id, 'ref-live', DateTime.now().plus({ minutes: 15 }))

    const command = await ace.create(LydiaExpire, [])
    await command.exec()

    command.assertSucceeded()
    const expired = await Payment.findByOrFail('orderRef', 'ref-old')
    const live = await Payment.findByOrFail('orderRef', 'ref-live')
    assert.equal(expired.status, 'expired')
    assert.equal(live.status, 'pending')
  })
})
