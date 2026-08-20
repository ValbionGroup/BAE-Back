import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import Client from '#models/client'
import Payment from '#models/payment'
import User from '#models/user'
import LydiaClient from '#services/lydia/lydia_client'
import FakeLydiaClient from '#services/lydia/fake_lydia_client'
import { openPayment } from '#services/payment_service'

async function makeClient(email: string): Promise<User> {
  const user = await User.create({
    email,
    password: 'secret-de-test',
    casId: `cas-${email}`,
    firstName: 'Camille',
    lastName: 'Renard',
  })
  await Client.create({ id: user.id, phone: null, promotion: null, registeredAt: DateTime.now() })
  return user
}

test.group('Ouverture d’un paiement', (group) => {
  let lydia: FakeLydiaClient

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    lydia = new FakeLydiaClient()
    app.container.swap(LydiaClient, () => lydia)
    return () => app.container.restore(LydiaClient)
  })

  /**
   * Le défaut visé : ouvrir un paiement sans garder le montant attendu, qui est
   * la seule défense contre un montant divergent à la confirmation.
   */
  test('un paiement ouvert est en attente et porte le montant attendu', async ({ assert }) => {
    const user = await makeClient('a@test.fr')

    const payment = await openPayment({
      user,
      kind: 'subscription',
      amountCents: 1500,
      message: 'Cotisation BAE',
      intent: { fastPassId: 7 },
      expireTimeSeconds: 900,
    })

    assert.equal(payment.status, 'pending')
    assert.equal(payment.amountCents, 1500)
    assert.equal(payment.mobileUrl, `https://lydia.test/pay/${payment.orderRef}`)
    assert.isNotNull(payment.providerReference)
    assert.equal(lydia.created[0].recipient, 'a@test.fr')
    assert.equal(lydia.created[0].amountCents, 1500)
  })

  /**
   * Le défaut visé : une `confirm_url` sans la référence, ou pointant ailleurs
   * que sur l'adresse publique — la notification n'arriverait jamais.
   */
  test('l’URL de rappel porte la référence de la commande', async ({ assert }) => {
    const user = await makeClient('b@test.fr')

    const payment = await openPayment({
      user,
      kind: 'subscription',
      amountCents: 1500,
      message: 'Cotisation BAE',
      intent: {},
      expireTimeSeconds: 900,
    })

    assert.include(lydia.created[0].confirmUrl, `/v1/lydia/callback/${payment.orderRef}`)
    assert.include(lydia.created[0].browserSuccessUrl, payment.orderRef)
  })

  /**
   * Le défaut visé : un refus de Lydia laissant un `pending` impayable, qui
   * encombrerait le rapprochement sans jamais aboutir.
   */
  test('un refus de Lydia laisse une trace annulée, jamais un paiement en attente', async ({
    assert,
  }) => {
    const user = await makeClient('c@test.fr')
    lydia.failNextCreate = true

    await assert.rejects(() =>
      openPayment({
        user,
        kind: 'subscription',
        amountCents: 1500,
        message: 'Cotisation BAE',
        intent: {},
        expireTimeSeconds: 900,
      })
    )

    const payments = await Payment.query().where('userId', user.id)
    assert.lengthOf(payments, 1)
    assert.equal(payments[0].status, 'cancelled')
    assert.isNull(payments[0].mobileUrl)
  })
})
