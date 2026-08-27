import { test } from '@japa/runner'
import { DateTime } from 'luxon'
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

async function seedMenu() {
  const event = await Event.create({
    name: 'Soirée Remise',
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

  await event.related('products').attach({ [hotdog.id]: { quantity: 200, price: HOTDOG_CENTS } })

  return { event, hotdog }
}

/**
 * ⚠️ La remise est la **seule** valeur monétaire que le panier a le droit
 * d'envoyer : tout le reste est relu en base parce qu'un total venu du client
 * serait falsifiable. C'est un geste humain, irrelisable ailleurs — d'où la
 * permission dédiée et la traçabilité, que ces tests gardent.
 */
test.group('Remise au comptoir', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function cashier(permissions: string[] = ['order:write', 'order:read', 'order:discount']) {
    return grantPermissions(await MemberFactory.create(), permissions)
  }

  test('la remise réduit le total de la commande', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const user = await cashier()

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({
        lines: [{ product_id: hotdog.id, quantity: 2 }],
        discount: { amount_cents: 100, label: 'Geste commercial' },
      })
      .loginAs(user)

    response.assertStatus(201)
    const body = response.body().data
    assert.equal(body.gross_cents, 2 * HOTDOG_CENTS)
    assert.equal(body.discount_cents, 100)
    assert.equal(body.total_cents, 2 * HOTDOG_CENTS - 100)
  })

  /**
   * ⚠️ Le test qui garde l'argent. `writeOrder` crée la transaction comptable à
   * `draft.totalCents` : si la remise n'entrait pas dans le draft, la commande
   * afficherait 4 € et la caisse en encaisserait 5.
   */
  test('la transaction comptable porte le montant remisé', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const user = await cashier()

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({
        lines: [{ product_id: hotdog.id, quantity: 2 }],
        discount: { amount_cents: 100, label: 'Geste commercial' },
      })
      .loginAs(user)

    const order = await Order.findOrFail(response.body().data.id)
    const transaction = await Transaction.findOrFail(order.transactionId)
    assert.equal(transaction.amount, 2 * HOTDOG_CENTS - 100)
  })

  test('la remise est enregistrée avec son motif et son auteur', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const user = await cashier()

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({
        lines: [{ product_id: hotdog.id, quantity: 1 }],
        discount: { amount_cents: 50, label: 'Erreur de préparation' },
      })
      .loginAs(user)

    const rows = await db.from('order_discounts').where('order_id', response.body().data.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].amount_cents, 50)
    assert.equal(rows[0].label, 'Erreur de préparation')
    assert.equal(Number(rows[0].applied_by_user_id), user.id)
    // Remise sur la commande entière, jamais sur une ligne : c'est le périmètre
    // retenu, et la colonne dit laquelle des deux.
    assert.isNull(rows[0].product_id)
  })

  /**
   * ⚠️ Sans plafond, un total négatif : le comptoir rendrait de la monnaie sur
   * une vente. La remise est ramenée au dû, elle n'est pas refusée — refuser
   * bloquerait un « c'est cadeau » parfaitement légitime.
   */
  test('la remise est plafonnée au total du panier', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const user = await cashier()

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({
        lines: [{ product_id: hotdog.id, quantity: 1 }],
        discount: { amount_cents: 99_999, label: 'Offert' },
      })
      .loginAs(user)

    response.assertStatus(201)
    assert.equal(response.body().data.total_cents, 0)
    assert.equal(response.body().data.discount_cents, HOTDOG_CENTS)

    const order = await Order.findOrFail(response.body().data.id)
    const transaction = await Transaction.findOrFail(order.transactionId)
    assert.equal(transaction.amount, 0)
  })

  test('une remise sans le droit order:discount est refusée', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const user = await cashier(['order:write', 'order:read'])

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({
        lines: [{ product_id: hotdog.id, quantity: 1 }],
        discount: { amount_cents: 100, label: 'Geste commercial' },
      })
      .loginAs(user)

    response.assertStatus(403)
    const rows = await db.from('orders').where('event_id', event.id)
    assert.lengthOf(rows, 0)
  })

  /** Le droit ne gouverne que la remise : encaisser reste possible sans lui. */
  test('sans le droit, un encaissement sans remise passe toujours', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const user = await cashier(['order:write', 'order:read'])

    const response = await client
      .post(`/v1/events/${event.id}/orders`)
      .json({ lines: [{ product_id: hotdog.id, quantity: 1 }] })
      .loginAs(user)

    response.assertStatus(201)
    assert.equal(response.body().data.total_cents, HOTDOG_CENTS)
  })

  test('la commande relue porte sa remise', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const user = await cashier()

    await client
      .post(`/v1/events/${event.id}/orders`)
      .json({
        lines: [{ product_id: hotdog.id, quantity: 2 }],
        discount: { amount_cents: 120, label: 'Geste commercial' },
      })
      .loginAs(user)

    const list = await client.get(`/v1/events/${event.id}/orders`).loginAs(user)

    list.assertStatus(200)
    const order = list.body().data[0]
    assert.equal(order.discount_cents, 120)
    assert.lengthOf(order.discounts, 1)
    assert.equal(order.discounts[0].label, 'Geste commercial')
  })
})

/**
 * Le paiement par carte sérialise le `OrderDraft` entier dans `payment.intent`
 * et facture `draft.totalCents`. La remise doit donc voyager dans le draft, ou
 * le terminal débiterait le prix plein.
 */
test.group('Remise et paiement par carte', (group) => {
  let sumup: FakeSumUpClient

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    sumup = new FakeSumUpClient()
    app.container.swap(SumUpClient, () => sumup)
    return () => app.container.restore(SumUpClient)
  })

  test('le terminal facture le montant remisé', async ({ client, assert }) => {
    const { event, hotdog } = await seedMenu()
    const user = await grantPermissions(await MemberFactory.create(), [
      'order:write',
      'order:read',
      'order:discount',
    ])

    const response = await client
      .post(`/v1/events/${event.id}/card-payments`)
      .json({
        lines: [{ product_id: hotdog.id, quantity: 2 }],
        discount: { amount_cents: 100, label: 'Geste commercial' },
      })
      .loginAs(user)

    response.assertStatus(201)
    const payment = await Payment.findByOrFail('orderRef', response.body().data.order_ref)
    assert.equal(payment.amountCents, 2 * HOTDOG_CENTS - 100)
  })
})
