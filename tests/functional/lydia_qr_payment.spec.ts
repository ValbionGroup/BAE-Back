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
import LydiaClient from '#services/lydia/lydia_client'
import FakeLydiaClient from '#services/lydia/fake_lydia_client'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

const HOTDOG_CENTS = 250

async function seedMenu(quantity = 200) {
  const event = await Event.create({
    name: 'Soirée Lydia QR',
    description: null,
    date: DateTime.fromISO('2026-03-21'),
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
 * Les seeders laissent des dizaines de commandes/paiements en base et la
 * transaction globale du test ne les annule pas : seul un repère relatif
 * prouve quelque chose. Cf. `card_payment.spec.ts`.
 */
async function countOrdersOf(eventId: number): Promise<number> {
  const row = await db.from('orders').where('event_id', eventId).count('* as total').first()
  return Number(row?.total ?? 0)
}

async function countLydiaPayments(): Promise<number> {
  const row = await db.from('payments').where('provider', 'lydia').count('* as total').first()
  return Number(row?.total ?? 0)
}

test.group('Encaissement par QR Lydia', (group) => {
  let lydia: FakeLydiaClient

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    lydia = new FakeLydiaClient()
    app.container.swap(LydiaClient, () => lydia)
    return () => app.container.restore(LydiaClient)
  })

  async function pay(
    httpClient: ApiClient,
    eventId: number,
    productId: number,
    phone: string | null,
    paymentData: string | null = 'QR-BRUT-XYZ',
    quantity = 2
  ) {
    const cashier = await MemberFactory.merge({ phone }).create()
    const user = await grantPermissions(cashier, ['order:write', 'order:read'])

    const response = await httpClient
      .post(`/v1/events/${eventId}/orders`)
      .json({
        lines: [{ product_id: productId, quantity }],
        payment_method: 'lydia',
        ...(paymentData !== null ? { payment_data: paymentData } : {}),
      })
      .loginAs(user)

    return { response, cashier }
  }

  test('encaisse, écrit la commande, la transaction et l’audit du paiement', async ({
    client: httpClient,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()

    const { response } = await pay(httpClient, event.id, hotdog.id, '0612345678')

    response.assertStatus(201)
    assert.equal(response.body().data.total_cents, 500)

    const order = await Order.query().where('eventId', event.id).firstOrFail()
    const transaction = await Transaction.findOrFail(order.transactionId!)
    assert.strictEqual(transaction.amount, 500)
    assert.equal(transaction.type, 'lydia')

    const payment = await Payment.query()
      .where('provider', 'lydia')
      .orderBy('id', 'desc')
      .firstOrFail()
    assert.equal(payment.kind, 'order')
    assert.equal(payment.status, 'paid')
    assert.equal(payment.transactionIdentifier, 'tx-fake')
    assert.equal(payment.transactionId, order.transactionId)

    assert.lengthOf(lydia.charged, 1)
    assert.equal(lydia.charged[0].phone, '0612345678')
    assert.equal(lydia.charged[0].paymentData, 'QR-BRUT-XYZ')
    assert.equal(lydia.charged[0].amountCents, 500)
  })

  test('un caissier sans téléphone est refusé avant tout appel à Lydia', async ({
    client: httpClient,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    const before = await countOrdersOf(event.id)

    const { response } = await pay(httpClient, event.id, hotdog.id, null)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_LYDIA_PHONE_MISSING')
    assert.equal(await countOrdersOf(event.id), before)
    assert.lengthOf(lydia.charged, 0)
  })

  test('paymentData absent est refusé sans jamais écrire de commande', async ({
    client: httpClient,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    const before = await countOrdersOf(event.id)

    const { response } = await pay(httpClient, event.id, hotdog.id, '0612345678', null)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_LYDIA_PAYMENT_DATA_MISSING')
    assert.equal(await countOrdersOf(event.id), before)
    assert.lengthOf(lydia.charged, 0)
  })

  test('un refus explicite de Lydia n’écrit aucune commande et transmet son message', async ({
    client: httpClient,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    lydia.nextCharge = 'decline'
    const before = await countOrdersOf(event.id)
    const beforePayments = await countLydiaPayments()

    const { response } = await pay(httpClient, event.id, hotdog.id, '0612345678')

    response.assertStatus(502)
    assert.equal(response.body().error.code, 'E_LYDIA_PAYMENT_REFUSED')
    assert.equal(await countOrdersOf(event.id), before)
    assert.equal(await countLydiaPayments(), beforePayments + 1)

    const payment = await Payment.query()
      .where('provider', 'lydia')
      .orderBy('id', 'desc')
      .firstOrFail()
    assert.equal(payment.status, 'refused')
  })

  test('un montant confirmé différent du montant attendu est refusé', async ({
    client: httpClient,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    // 2 × 250 = 500 attendus ; Lydia confirme 400.
    lydia.nextCharge = { transactionIdentifier: 'lydia-tx-2', amountCents: 400 }
    const before = await countOrdersOf(event.id)

    const { response } = await pay(httpClient, event.id, hotdog.id, '0612345678')

    response.assertStatus(502)
    assert.equal(response.body().error.code, 'E_LYDIA_AMOUNT_MISMATCH')
    assert.equal(await countOrdersOf(event.id), before)

    const payment = await Payment.query()
      .where('provider', 'lydia')
      .orderBy('id', 'desc')
      .firstOrFail()
    assert.equal(payment.status, 'refused')
  })

  test('un produit hors menu est refusé avant tout appel à Lydia', async ({
    client: httpClient,
    assert,
  }) => {
    const { event } = await seedMenu()
    const other = await Product.create({
      name: 'Hors menu',
      isVegetarian: false,
      description: null,
      recipe: null,
    })

    const { response } = await pay(httpClient, event.id, other.id, '0612345678')

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_PRODUCT_NOT_ON_MENU')
    assert.lengthOf(lydia.charged, 0)
  })

  test('paymentMethod cash reste inchangé : aucun appel à Lydia', async ({
    client: httpClient,
    assert,
  }) => {
    const { event, hotdog } = await seedMenu()
    const cashier = await MemberFactory.create()
    const user = await grantPermissions(cashier, ['order:write', 'order:read'])

    const response = await httpClient
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 1 }] })
      .loginAs(user)

    response.assertStatus(201)
    assert.lengthOf(lydia.charged, 0)
  })
})
