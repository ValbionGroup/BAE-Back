import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import FastPass from '#models/fast_pass'
import Order from '#models/order'
import PreOrder from '#models/pre_order'
import Product from '#models/product'
import Transaction from '#models/transaction'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

interface LedgerRow {
  id: number
  nature: string
  label: string | null
  item_count: number
  payer: string | null
}

async function staff() {
  return grantPermissions(await MemberFactory.create(), ['transaction:read'])
}

async function seedEvent() {
  return Event.create({
    name: 'Soirée Hivernale',
    description: null,
    date: DateTime.fromISO('2026-02-14T20:00:00.000+01:00'),
    status: 'ongoing',
    duration: 4 * 60 * 60,
  })
}

async function seedProduct(name: string) {
  return Product.create({ name, isVegetarian: false, description: null, recipe: null })
}

async function rowFor(client: ApiClient, user: User, transactionId: number): Promise<LedgerRow> {
  const response = await client.get('/v1/transactions').loginAs(user)
  response.assertStatus(200)
  const rows = (response.body() as { data: LedgerRow[] }).data
  return rows.find((row) => row.id === transactionId)!
}

test.group('Transactions — registre unique', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * Le défaut visé : `preload('orders')` seul ne disait ni la nature ni le
   * volume. La page n'avait que « N commandes » à afficher, ce qui vaut « 1 »
   * dans la quasi-totalité des cas.
   */
  test('compte les articles et nomme la soirée d’un encaissement de caisse', async ({
    assert,
    client,
  }) => {
    const user = await staff()
    const event = await seedEvent()
    const hotdog = await seedProduct('Hot-dog classique')
    const frites = await seedProduct('Frites')
    const transaction = await Transaction.create({ type: 'cash', amount: 1200 })

    const order = await Order.create({
      eventId: event.id,
      transactionId: transaction.id,
      status: 'completed',
      payerName: 'Tom Bernard',
    })
    await order.related('products').attach({
      [hotdog.id]: { quantity: 3 },
      [frites.id]: { quantity: 1 },
    })

    const row = await rowFor(client, user, transaction.id)
    assert.equal(row.nature, 'order')
    assert.equal(row.label, 'Soirée Hivernale')
    assert.equal(row.item_count, 4)
    assert.equal(row.payer, 'Tom Bernard')
  })

  /**
   * Le défaut visé, distinct : une précommande n'a pas d'`Order`, donc elle
   * tombait à `order_ids: []` — une ligne vide au milieu du registre.
   */
  test('résume le produit et nomme le payeur d’une précommande', async ({ assert, client }) => {
    const user = await staff()
    const event = await seedEvent()
    const product = await seedProduct('Pack solo')
    const buyer = await MemberFactory.merge({}).with('user', 1).create()
    const transaction = await Transaction.create({ type: 'lydia', amount: 850 })

    const preOrder = await PreOrder.create({
      userId: buyer.id,
      eventId: event.id,
      transactionId: transaction.id,
      pickupAt: null,
    })
    await db.table('pre_order_items').insert({
      pre_order_id: preOrder.id,
      product_id: product.id,
      quantity: 2,
      received_quantity: 0,
      created_at: DateTime.now().toSQL({ includeOffset: false }),
      updated_at: DateTime.now().toSQL({ includeOffset: false }),
    })

    const buyerUser = await User.findOrFail(buyer.id)
    const row = await rowFor(client, user, transaction.id)
    assert.equal(row.nature, 'pre_order')
    assert.equal(row.label, 'Pack solo')
    assert.equal(row.item_count, 2)
    assert.equal(row.payer, buyerUser.fullName)
  })

  /**
   * Le défaut visé : `Transaction` ne déclarait aucune relation vers
   * `subscriptions`, donc une cotisation encaissée n'était qu'un montant nu.
   */
  test('nomme le fast pass d’une cotisation', async ({ assert, client }) => {
    const user = await staff()
    const fastPass = await FastPass.create({
      label: 'Adhésion 1 an',
      description: null,
      price: 1000,
      duration: 1,
    })
    const adherent = await MemberFactory.with('user', 1).create()
    const transaction = await Transaction.create({ type: 'card', amount: 1000 })

    await db.table('subscriptions').insert({
      user_id: adherent.id,
      fast_pass_id: fastPass.id,
      subscribed_at: DateTime.now().toSQL(),
      transaction_id: transaction.id,
      created_at: DateTime.now().toSQL(),
      updated_at: DateTime.now().toSQL(),
    })

    const adherentUser = await User.findOrFail(adherent.id)
    const row = await rowFor(client, user, transaction.id)
    assert.equal(row.nature, 'subscription')
    assert.equal(row.label, 'Adhésion 1 an')
    assert.equal(row.item_count, 0)
    assert.equal(row.payer, adherentUser.fullName)
  })

  /**
   * Le défaut visé : le filtre par soirée ne regardait que `orders`. Une
   * précommande n'en a pas, donc elle disparaissait du registre dès qu'une
   * soirée était active — un encaissement caché, pas seulement mal étiqueté.
   */
  test('garde les précommandes de la soirée quand on filtre par soirée', async ({
    assert,
    client,
  }) => {
    const user = await staff()
    const event = await seedEvent()
    const product = await seedProduct('Pack solo')
    const buyer = await MemberFactory.with('user', 1).create()
    const transaction = await Transaction.create({ type: 'lydia', amount: 850 })

    const preOrder = await PreOrder.create({
      userId: buyer.id,
      eventId: event.id,
      transactionId: transaction.id,
      pickupAt: null,
    })
    await db.table('pre_order_items').insert({
      pre_order_id: preOrder.id,
      product_id: product.id,
      quantity: 2,
      received_quantity: 0,
      created_at: DateTime.now().toSQL({ includeOffset: false }),
      updated_at: DateTime.now().toSQL({ includeOffset: false }),
    })

    const response = await client.get(`/v1/transactions?eventId=${event.id}`).loginAs(user)
    response.assertStatus(200)
    const rows = (response.body() as { data: LedgerRow[] }).data

    assert.isDefined(rows.find((row) => row.id === transaction.id))
  })
})
