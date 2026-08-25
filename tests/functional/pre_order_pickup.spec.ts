import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import PreOrder from '#models/pre_order'
import Product from '#models/product'
import Transaction from '#models/transaction'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

/** 20 h pile : toutes les bornes de créneau se lisent à l'œil depuis là. */
const EVENT_START = DateTime.fromISO('2026-02-14T20:00:00.000+01:00')

async function seed(pickupAt: DateTime | null = null) {
  const event = await Event.create({
    name: 'Soirée Hivernale',
    description: null,
    date: EVENT_START,
    status: 'ongoing',
    duration: 4 * 60 * 60,
  })
  const product = await Product.create({
    name: 'Hot-dog classique',
    isVegetarian: false,
    description: null,
    recipe: null,
  })
  const owner = await MemberFactory.with('user', 1).create()
  const transaction = await Transaction.create({ type: 'lydia', amount: 700 })

  const preOrder = await PreOrder.create({
    userId: owner.id,
    eventId: event.id,
    transactionId: transaction.id,
    pickupAt,
  })

  await db.table('pre_order_items').insert({
    pre_order_id: preOrder.id,
    product_id: product.id,
    quantity: 2,
    received_quantity: 0,
    created_at: DateTime.now().toSQL({ includeOffset: false }),
    updated_at: DateTime.now().toSQL({ includeOffset: false }),
  })

  return { event, product, preOrder }
}

async function staff() {
  return grantPermissions(await MemberFactory.create(), ['order:read', 'order:write'])
}

test.group('Précommandes — créneau de retrait', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('pose un créneau aligné sur le quart d’heure', async ({ client, assert }) => {
    const { preOrder } = await seed()

    const response = await client
      .patch(`/v1/pre-orders/${preOrder.id}/pickup`)
      .json({ pickupAt: EVENT_START.plus({ minutes: 45 }).toISO() })
      .loginAs(await staff())

    response.assertStatus(200)
    assert.equal(
      DateTime.fromISO(response.body().data.pickup_at).toMillis(),
      EVENT_START.plus({ minutes: 45 }).toMillis()
    )
  })

  test('refuse une heure qui ne tombe pas sur un quart d’heure', async ({ client, assert }) => {
    const { preOrder } = await seed()

    const response = await client
      .patch(`/v1/pre-orders/${preOrder.id}/pickup`)
      .json({ pickupAt: EVENT_START.plus({ minutes: 37 }).toISO() })
      .loginAs(await staff())

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_PICKUP_SLOT_MISALIGNED')
  })

  test('refuse un créneau après la fin de la soirée', async ({ client, assert }) => {
    const { preOrder } = await seed()

    const response = await client
      .patch(`/v1/pre-orders/${preOrder.id}/pickup`)
      .json({ pickupAt: EVENT_START.plus({ hours: 5 }).toISO() })
      .loginAs(await staff())

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_PICKUP_SLOT_OUT_OF_RANGE')
  })

  test('refuse un créneau avant le début de la soirée', async ({ client, assert }) => {
    const { preOrder } = await seed()

    const response = await client
      .patch(`/v1/pre-orders/${preOrder.id}/pickup`)
      .json({ pickupAt: EVENT_START.minus({ minutes: 15 }).toISO() })
      .loginAs(await staff())

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_PICKUP_SLOT_OUT_OF_RANGE')
  })

  /**
   * Retirer le créneau n'est pas la même chose que ne pas y toucher : la
   * commande repasse en tête de file, `due` valant `true` sans heure.
   */
  test('accepte null pour retirer le créneau', async ({ client, assert }) => {
    const { preOrder } = await seed(EVENT_START.plus({ minutes: 30 }))

    const response = await client
      .patch(`/v1/pre-orders/${preOrder.id}/pickup`)
      .json({ pickupAt: null })
      .loginAs(await staff())

    response.assertStatus(200)
    assert.isNull(response.body().data.pickup_at)
    assert.isTrue(response.body().data.due)
  })

  test('déplace un créneau déjà posé', async ({ client, assert }) => {
    const { preOrder } = await seed(EVENT_START.plus({ minutes: 30 }))

    const response = await client
      .patch(`/v1/pre-orders/${preOrder.id}/pickup`)
      .json({ pickupAt: EVENT_START.plus({ hours: 1 }).toISO() })
      .loginAs(await staff())

    response.assertStatus(200)
    assert.equal(
      DateTime.fromISO(response.body().data.pickup_at).toMillis(),
      EVENT_START.plus({ hours: 1 }).toMillis()
    )
  })

  test('refuse de déplacer une précommande déjà remise', async ({ client, assert }) => {
    const { preOrder } = await seed(EVENT_START.plus({ minutes: 30 }))
    await db
      .from('pre_order_items')
      .where('pre_order_id', preOrder.id)
      .update({ received_quantity: db.raw('quantity') })

    const response = await client
      .patch(`/v1/pre-orders/${preOrder.id}/pickup`)
      .json({ pickupAt: EVENT_START.plus({ hours: 1 }).toISO() })
      .loginAs(await staff())

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_PRE_ORDER_ALREADY_COLLECTED')
  })

  test('refuse un membre sans la permission order:write', async ({ client }) => {
    const { preOrder } = await seed()
    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])

    const response = await client
      .patch(`/v1/pre-orders/${preOrder.id}/pickup`)
      .json({ pickupAt: EVENT_START.plus({ minutes: 15 }).toISO() })
      .loginAs(user)

    response.assertStatus(403)
  })
})
