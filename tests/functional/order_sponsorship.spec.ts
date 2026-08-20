import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import Order from '#models/order'
import Product from '#models/product'
import Transaction from '#models/transaction'
import SponsorshipCategory from '#models/sponsorship_category'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

const BURGER_CENTS = 400
const FRITES_CENTS = 200

async function seed(payerName: string | null = 'BDE') {
  const event = await Event.create({
    name: 'Soirée Hivernale',
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'ongoing',
    duration: 4,
    payerName,
  })

  const burger = await Product.create({
    name: 'Burger maison',
    isVegetarian: false,
    description: null,
    recipe: null,
  })
  const frites = await Product.create({
    name: 'Frites',
    isVegetarian: true,
    description: null,
    recipe: null,
  })

  await event.related('products').attach({
    [burger.id]: { quantity: 200, price: BURGER_CENTS },
    [frites.id]: { quantity: 200, price: FRITES_CENTS },
  })

  return { event, burger, frites }
}

async function category(event: Event, label: string, prices: Record<number, number>) {
  const created = await SponsorshipCategory.create({
    eventId: event.id,
    label,
    qrNonce: 'nonce-test',
  })

  for (const [productId, priceCents] of Object.entries(prices)) {
    await db.table('sponsorship_prices').insert({
      category_id: created.id,
      product_id: Number(productId),
      price_cents: priceCents,
      created_at: new Date(),
      updated_at: new Date(),
    })
  }

  return created
}

function seller() {
  return MemberFactory.create().then((member) =>
    grantPermissions(member, ['order:write', 'order:read'])
  )
}

test.group('Orders — prise en charge', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('facture le prix de catégorie et fige le prix public', async ({ client, assert }) => {
    const { event, burger } = await seed()
    const tier = await category(event, 'Staff BDE', { [burger.id]: 0 })
    const user = await seller()

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: burger.id, quantity: 2 }], sponsorship_category_id: tier.id })
      .loginAs(user)

    response.assertStatus(201)

    const data = response.body().data
    assert.equal(data.gross_cents, 800)
    assert.equal(data.total_cents, 0)
    assert.equal(data.sponsored_cents, 800)
    assert.equal(data.discount_cents, 0)
    assert.equal(data.sponsorship.label, 'Staff BDE')
    assert.equal(data.sponsorship.payer_name, 'BDE')

    const order = await Order.query().where('eventId', event.id).firstOrFail()
    const line = await db.from('order_products').where('order_id', order.id).firstOrFail()
    assert.equal(Number(line.unit_price_cents), 0)
    assert.equal(Number(line.list_price_cents), BURGER_CENTS)
  })

  test('vend au prix public un article absent de la grille', async ({ client, assert }) => {
    const { event, burger, frites } = await seed()
    const tier = await category(event, 'Staff BDE', { [burger.id]: 200 })
    const user = await seller()

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({
        lines: [
          { product_id: burger.id, quantity: 1 },
          { product_id: frites.id, quantity: 1 },
        ],
        sponsorship_category_id: tier.id,
      })
      .loginAs(user)

    response.assertStatus(201)

    const data = response.body().data
    assert.equal(data.gross_cents, BURGER_CENTS + FRITES_CENTS)
    assert.equal(data.total_cents, 200 + FRITES_CENTS)
    // Seul le burger est tarifé : les frites ne doivent rien au payeur.
    assert.equal(data.sponsored_cents, 200)
  })

  test('encaisse le montant facturé, pas la valeur publique', async ({ client, assert }) => {
    const { event, burger } = await seed()
    const tier = await category(event, 'Staff BDE', { [burger.id]: 200 })
    const user = await seller()

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: burger.id, quantity: 3 }], sponsorship_category_id: tier.id })
      .loginAs(user)

    const order = await Order.findOrFail(response.body().data.id)
    const transaction = await Transaction.findOrFail(order.transactionId!)
    assert.equal(Number(transaction.amount), 6)
  })

  test('tient l’invariant gross = total + discount + sponsored, avec et sans catégorie', async ({
    client,
    assert,
  }) => {
    const { event, burger } = await seed()
    const tier = await category(event, 'Staff BDE', { [burger.id]: 150 })
    const user = await seller()

    for (const body of [
      { lines: [{ product_id: burger.id, quantity: 2 }], sponsorship_category_id: tier.id },
      { lines: [{ product_id: burger.id, quantity: 2 }] },
    ]) {
      const response = await client.post(`/v1/events/${event.id}/orders`).json(body).loginAs(user)
      const data = response.body().data
      assert.equal(data.gross_cents, data.total_cents + data.discount_cents + data.sponsored_cents)
    }
  })

  test('refuse une catégorie appartenant à une autre soirée', async ({ client }) => {
    const { event, burger } = await seed()
    const other = await seed()
    const foreign = await category(other.event, 'Staff BDE', { [other.burger.id]: 0 })
    const user = await seller()

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({
        lines: [{ product_id: burger.id, quantity: 1 }],
        sponsorship_category_id: foreign.id,
      })
      .loginAs(user)

    response.assertStatus(422)
    response.assertBodyContains({ error: { code: 'E_CATEGORY_NOT_FOUND' } })
  })

  test('ne bouge plus quand la grille change après la vente', async ({ client, assert }) => {
    const { event, burger } = await seed()
    const tier = await category(event, 'Staff BDE', { [burger.id]: 100 })
    const user = await seller()

    const created = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: burger.id, quantity: 1 }], sponsorship_category_id: tier.id })
      .loginAs(user)

    await db
      .from('sponsorship_prices')
      .where('category_id', tier.id)
      .where('product_id', burger.id)
      .update({ price_cents: 350 })

    const listed = await client.get(`/v1/events/${event.id}/orders`).loginAs(user)
    const payload = listed
      .body()
      .data.find((row: { id: number }) => row.id === created.body().data.id)

    assert.equal(payload.total_cents, 100)
    assert.equal(payload.sponsored_cents, 300)
  })

  test('garde le payeur d’origine si la soirée en change ensuite', async ({ client, assert }) => {
    const { event, burger } = await seed()
    const tier = await category(event, 'Staff BDE', { [burger.id]: 0 })
    const user = await seller()

    const created = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: burger.id, quantity: 1 }], sponsorship_category_id: tier.id })
      .loginAs(user)

    event.payerName = 'BAR'
    await event.save()

    const order = await Order.findOrFail(created.body().data.id)
    assert.equal(order.payerName, 'BDE')
  })

  test('laisse une commande sans catégorie strictement inchangée', async ({ client, assert }) => {
    const { event, burger } = await seed()
    const user = await seller()

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: burger.id, quantity: 2 }] })
      .loginAs(user)

    const data = response.body().data
    assert.equal(data.gross_cents, 800)
    assert.equal(data.total_cents, 800)
    assert.equal(data.sponsored_cents, 0)
    assert.equal(data.discount_cents, 0)
    assert.isNull(data.sponsorship)
  })
})
