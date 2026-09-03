import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import Client from '#models/client'
import FastPass from '#models/fast_pass'
import Payment from '#models/payment'
import User from '#models/user'
import LydiaClient from '#services/lydia/lydia_client'
import FakeLydiaClient from '#services/lydia/fake_lydia_client'

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

/**
 * Le plus grand `transactions.id` du moment.
 *
 * Les comptes absolus ne prouvent rien ici : les seeders laissent des dizaines
 * de transactions `lydia` en base, et la transaction globale du test ne les
 * annule pas. Ce repère permet de ne compter que ce que le test a créé.
 */
async function lastTransactionId(): Promise<number> {
  const row = await db.from('transactions').max('id as max').first()
  return Number(row?.max ?? 0)
}

/** Ouvre une cotisation en attente et rend de quoi la notifier. */
async function openSubscriptionPayment(httpClient: ApiClient, email: string, priceCents = 1500) {
  const user = await makeClient(email)
  const formula = await FastPass.create({
    label: 'Année',
    // ⚠️ **Centimes**, comme toute valeur monétaire depuis le 2026-08-25. Le
    // paramètre s'appelait `priceEuros` et valait 15 : la fixture entérinait la
    // double conversion qu'appliquait alors le contrôleur.
    price: priceCents,
    duration: 1,
    description: null,
  })

  const response = await httpClient
    .post('/v1/account/subscriptions')
    .json({ fastPassId: formula.id })
    .loginAs(user)

  const body = response.body() as { data: { order_ref: string } }
  return { user, formula, orderRef: body.data.order_ref }
}

test.group('Notification de paiement Lydia', (group) => {
  let lydia: FakeLydiaClient

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    lydia = new FakeLydiaClient()
    app.container.swap(LydiaClient, () => lydia)
    return () => app.container.restore(LydiaClient)
  })

  /**
   * Le défaut visé : Lydia réémet ses notifications. Deux appels créant deux
   * transactions doubleraient la recette et la cotisation.
   */
  test('une notification rejouée n’encaisse qu’une fois', async ({
    client: httpClient,
    assert,
  }) => {
    const { user, orderRef } = await openSubscriptionPayment(httpClient, 'a@test.fr')
    const before = await lastTransactionId()

    await httpClient.post(`/v1/lydia/callback/${orderRef}`).json({})
    await httpClient.post(`/v1/lydia/callback/${orderRef}`).json({})

    assert.lengthOf(await db.from('subscriptions').where('user_id', user.id), 1)
    assert.lengthOf(
      await db.from('transactions').where('id', '>', before),
      1,
      'deux notifications, une seule transaction'
    )
  })

  /**
   * Le défaut visé : croire le montant du prestataire sans le comparer à
   * l'attendu, et livrer la contrepartie pour moins que son prix.
   */
  test('un montant confirmé inférieur à l’attendu n’obtient aucune contrepartie', async ({
    client: httpClient,
    assert,
  }) => {
    const { user, orderRef } = await openSubscriptionPayment(httpClient, 'b@test.fr')
    const before = await lastTransactionId()
    lydia.nextState = { state: 1, amountCents: 100, transactionIdentifier: 'tx-1' }

    await httpClient.post(`/v1/lydia/callback/${orderRef}`).json({})

    assert.lengthOf(await db.from('subscriptions').where('user_id', user.id), 0)
    assert.lengthOf(await db.from('transactions').where('id', '>', before), 0)

    const payment = await Payment.findByOrFail('orderRef', orderRef)
    assert.equal(payment.status, 'refused')
  })

  /**
   * Le défaut visé : traiter la notification en croyant son corps. Un corps
   * annonçant « payé » sur une demande que Lydia dit en attente ne doit rien
   * déclencher — c'est `state.json` qui décide, pas l'appelant.
   */
  test('le corps de la notification ne décide de rien', async ({ client: httpClient, assert }) => {
    const { user, orderRef } = await openSubscriptionPayment(httpClient, 'c@test.fr')
    lydia.nextState = { state: 0, amountCents: null, transactionIdentifier: null }

    await httpClient
      .post(`/v1/lydia/callback/${orderRef}`)
      .json({ state: 1, amount: '15.00', transaction_identifier: 'forge' })

    assert.lengthOf(await db.from('subscriptions').where('user_id', user.id), 0)

    const payment = await Payment.findByOrFail('orderRef', orderRef)
    assert.equal(payment.status, 'pending')
  })

  /**
   * Le défaut visé : un refus laissé en attente, qui resterait à confirmer
   * indéfiniment et fausserait le rapprochement.
   */
  test('un refus et une annulation sont enregistrés comme tels', async ({
    client: httpClient,
    assert,
  }) => {
    const refused = await openSubscriptionPayment(httpClient, 'd@test.fr')
    lydia.nextState = { state: 5, amountCents: null, transactionIdentifier: null }
    await httpClient.post(`/v1/lydia/callback/${refused.orderRef}`).json({})
    const refusedPayment = await Payment.findByOrFail('orderRef', refused.orderRef)
    assert.equal(refusedPayment.status, 'refused')

    const cancelled = await openSubscriptionPayment(httpClient, 'e@test.fr')
    lydia.nextState = { state: 6, amountCents: null, transactionIdentifier: null }
    await httpClient.post(`/v1/lydia/callback/${cancelled.orderRef}`).json({})
    const cancelledPayment = await Payment.findByOrFail('orderRef', cancelled.orderRef)
    assert.equal(cancelledPayment.status, 'cancelled')
  })

  /**
   * Le défaut visé : répondre en erreur à une référence inconnue. Lydia
   * rejouerait alors indéfiniment une notification qui n'aboutira jamais.
   */
  test('une référence inconnue est acceptée sans erreur', async ({ client: httpClient }) => {
    const response = await httpClient.post('/v1/lydia/callback/inconnue').json({})
    response.assertStatus(204)
  })

  /**
   * Le défaut visé : une contrepartie sans transaction rattachée, ou rattachée
   * à une transaction que la cotisation ne référence pas.
   */
  test('la cotisation confirmée porte la transaction qui l’a payée', async ({
    client: httpClient,
    assert,
  }) => {
    const { user, orderRef } = await openSubscriptionPayment(httpClient, 'f@test.fr')

    await httpClient.post(`/v1/lydia/callback/${orderRef}`).json({})

    const rows = await db.from('subscriptions').where('user_id', user.id)
    const payment = await Payment.findByOrFail('orderRef', orderRef)
    const transaction = await db.from('transactions').where('id', payment.transactionId!).first()

    assert.equal(payment.status, 'paid')
    assert.equal(rows[0].transaction_id, payment.transactionId)
    assert.strictEqual(transaction.amount, 1500)
    assert.equal(transaction.type, 'lydia')
  })
})
