import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Order from '#models/order'
import Payment from '#models/payment'
import Product from '#models/product'
import Transaction from '#models/transaction'
import SumUpClient from '#services/sumup/sumup_client'
import FakeSumUpClient from '#services/sumup/fake_sumup_client'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

const HOTDOG_CENTS = 250

async function seedMenu(quantity = 200) {
  const event = await Event.create({
    name: 'Soirée Carte Bleue',
    description: null,
    date: DateTime.fromISO('2026-03-14'),
    status: 'ongoing',
    duration: 4 * 60 * 60,
  })

  const hotdog = await Product.create({
    name: 'Hot-dog classique',
    isVegetarian: false,
    description: null,
    recipe: null,
  })

  await event.related('products').attach({ [hotdog.id]: { quantity, price: HOTDOG_CENTS } })

  return { event, hotdog }
}

/**
 * Les seeders laissent des dizaines de commandes en base et la transaction
 * globale du test ne les annule pas : seul un repère relatif prouve quelque
 * chose. Cf. `lydia_callback.spec.ts`.
 */
async function countOrdersOf(eventId: number): Promise<number> {
  const row = await db.from('orders').where('event_id', eventId).count('* as total').first()
  return Number(row?.total ?? 0)
}

/**
 * Le paiement par carte débite **avant** d'écrire. Tout ce que ces tests
 * gardent découle de cet ordre : rien ne doit exister tant que la carte n'a pas
 * répondu, et une fois qu'elle a répondu, plus rien ne doit empêcher d'écrire.
 */
test.group('Encaissement par carte — SumUp', (group) => {
  let sumup: FakeSumUpClient

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    sumup = new FakeSumUpClient()
    app.container.swap(SumUpClient, () => sumup)
    return () => app.container.restore(SumUpClient)
  })

  async function openPayment(
    httpClient: ApiClient,
    eventId: number,
    productId: number,
    quantity = 2
  ) {
    const cashier = await MemberFactory.create()
    const user = await grantPermissions(cashier, ['order:write', 'order:read'])

    const response = await httpClient
      .post(`/v1/events/${eventId}/card-payments`)
      .json({ lines: [{ product_id: productId, quantity }] })
      .loginAs(user)

    return { response, user }
  }

  /**
   * Le défaut visé : écrire la commande dès l'ouverture, comme le fait
   * l'espèce. Le client repartirait avec un ticket sans avoir payé.
   */
  test('ouvrir un paiement n’écrit aucune commande', async ({ client: httpClient, assert }) => {
    const { event, hotdog } = await seedMenu()

    const { response } = await openPayment(httpClient, event.id, hotdog.id)

    response.assertStatus(201)
    assert.equal(await countOrdersOf(event.id), 0)

    const payment = await Payment.findBy('orderRef', response.body().data.order_ref)
    assert.isNotNull(payment)
    assert.equal(payment!.status, 'pending')
    assert.equal(payment!.provider, 'sumup')
    assert.equal(payment!.kind, 'order')
    assert.equal(payment!.amountCents, 2 * HOTDOG_CENTS)
  })

  /**
   * Le défaut visé : envoyer au TPE un total calculé par l'écran. Le montant
   * doit venir du menu relu en base, en centimes.
   */
  test('le montant envoyé au lecteur est celui du menu', async ({ client: httpClient, assert }) => {
    const { event, hotdog } = await seedMenu()

    await openPayment(httpClient, event.id, hotdog.id, 3)

    assert.lengthOf(sumup.checkouts, 1)
    assert.equal(sumup.checkouts[0].amountCents, 3 * HOTDOG_CENTS)
  })

  /**
   * Le défaut visé : ne rien écrire au retour du webhook, ou écrire une
   * transaction du mauvais type. `card` est ce que lisent les états.
   */
  test('un paiement accepté écrit la commande et une transaction card', async ({
    client: httpClient,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    const { response } = await openPayment(httpClient, event.id, hotdog.id)
    const orderRef = response.body().data.order_ref

    sumup.nextState = { state: 'successful', amountCents: 500, transactionCode: 'TX-1' }
    await httpClient.post(`/v1/sumup/callback/${orderRef}`).json({})

    assert.equal(await countOrdersOf(event.id), 1)

    const order = await Order.query().where('eventId', event.id).firstOrFail()
    const transaction = await Transaction.findOrFail(order.transactionId)
    assert.equal(transaction.type, 'card')
    assert.strictEqual(transaction.amount, 500)

    const payment = await Payment.findByOrFail('orderRef', orderRef)
    assert.equal(payment.status, 'paid')
    assert.equal(payment.transactionIdentifier, 'TX-1')
  })

  /**
   * Le défaut visé : SumUp réémet ses webhooks. Deux appels créant deux
   * commandes doubleraient la recette.
   */
  test('un webhook rejoué n’encaisse qu’une fois', async ({ client: httpClient, assert }) => {
    const { event, hotdog } = await seedMenu()
    const { response } = await openPayment(httpClient, event.id, hotdog.id)
    const orderRef = response.body().data.order_ref

    sumup.nextState = { state: 'successful', amountCents: 500, transactionCode: 'TX-1' }
    await httpClient.post(`/v1/sumup/callback/${orderRef}`).json({})
    await httpClient.post(`/v1/sumup/callback/${orderRef}`).json({})

    assert.equal(await countOrdersOf(event.id), 1)
  })

  /**
   * Le défaut visé : traiter un refus comme un succès, ou laisser le paiement
   * en attente pour toujours. Une carte refusée ne laisse aucune commande.
   */
  test('une carte refusée n’écrit rien', async ({ client: httpClient, assert }) => {
    const { event, hotdog } = await seedMenu()
    const { response } = await openPayment(httpClient, event.id, hotdog.id)
    const orderRef = response.body().data.order_ref

    sumup.nextState = { state: 'failed', amountCents: null, transactionCode: null }
    await httpClient.post(`/v1/sumup/callback/${orderRef}`).json({})

    assert.equal(await countOrdersOf(event.id), 0)
    const payment = await Payment.findByOrFail('orderRef', orderRef)
    assert.equal(payment.status, 'refused')
  })

  /**
   * Le défaut visé : croire le montant sur parole. Un débit différent de ce qui
   * a été demandé ne doit pas produire de commande au prix demandé.
   */
  test('un montant débité divergent est refusé', async ({ client: httpClient, assert }) => {
    const { event, hotdog } = await seedMenu()
    const { response } = await openPayment(httpClient, event.id, hotdog.id)
    const orderRef = response.body().data.order_ref

    sumup.nextState = { state: 'successful', amountCents: 100, transactionCode: 'TX-2' }
    await httpClient.post(`/v1/sumup/callback/${orderRef}`).json({})

    assert.equal(await countOrdersOf(event.id), 0)
    const payment = await Payment.findByOrFail('orderRef', orderRef)
    assert.equal(payment.status, 'refused')
  })

  /**
   * Le défaut visé, et le plus coûteux : lancer le TPE sur un panier que
   * l'écriture refusera ensuite. La carte serait débitée sans contrepartie.
   */
  test('un panier en rupture est refusé avant que le lecteur ne s’allume', async ({
    client: httpClient,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    await db
      .table('production_runs')
      .insert({ event_id: event.id, product_id: hotdog.id, quantity: 1, created_at: new Date() })

    const { response } = await openPayment(httpClient, event.id, hotdog.id, 5)

    response.assertStatus(422)
    assert.lengthOf(sumup.checkouts, 0)
    assert.equal(await countOrdersOf(event.id), 0)
  })

  /**
   * Le défaut visé : annuler à l'écran sans rien dire au terminal. Le TPE
   * resterait à attendre une carte, et refuserait le paiement suivant.
   */
  test('annuler interrompt le paiement sur le lecteur', async ({ client: httpClient, assert }) => {
    const { event, hotdog } = await seedMenu()
    const { response, user } = await openPayment(httpClient, event.id, hotdog.id)
    const orderRef = response.body().data.order_ref

    await httpClient.post(`/v1/card-payments/${orderRef}/cancel`).loginAs(user)

    assert.equal(sumup.terminated, 1)
    const payment = await Payment.findByOrFail('orderRef', orderRef)
    assert.equal(payment.status, 'cancelled')
  })
})
