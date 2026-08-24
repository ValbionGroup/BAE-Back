import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import Product from '#models/product'
import SponsorshipCategory from '#models/sponsorship_category'
import { buildReceivablesHtml } from '#services/print/print_receivables'
import { receivablesForEvent } from '#services/receivable_service'
import { grantPermissions } from '#tests/helpers/permissions'
import { MemberFactory } from '#database/factories/members_factory'

const BURGER_CENTS = 400

async function seed() {
  const event = await Event.create({
    name: 'Soirée Hivernale',
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'ongoing',
    duration: 4 * 60 * 60,
    payerName: 'BDE',
  })

  const burger = await Product.create({
    name: 'Burger & frites',
    isVegetarian: false,
    description: null,
    recipe: null,
  })
  await event.related('products').attach({ [burger.id]: { quantity: 200, price: BURGER_CENTS } })

  const category = await SponsorshipCategory.create({
    eventId: event.id,
    label: 'Staff BDE',
    qrNonce: 'nonce',
  })

  return { event, burger, category }
}

async function order(
  eventId: number,
  categoryId: number | null,
  productId: number,
  quantity: number,
  unitPriceCents: number,
  status = 'pending'
) {
  const [row] = await db
    .table('orders')
    .insert({
      event_id: eventId,
      status,
      sponsorship_category_id: categoryId,
      sponsorship_category_label: categoryId ? 'Staff BDE' : null,
      payer_name: categoryId ? 'BDE' : null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('id')

  await db.table('order_products').insert({
    order_id: typeof row === 'object' ? Number(row.id) : Number(row),
    product_id: productId,
    quantity,
    unit_price_cents: unitPriceCents,
    list_price_cents: BURGER_CENTS,
  })
}

test.group('Justificatif de prise en charge', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('ventile par catégorie et par article, et totalise le dû', async ({ assert }) => {
    const { event, burger, category } = await seed()
    await order(event.id, category.id, burger.id, 2, 100)

    const statement = await receivablesForEvent(event.id)

    assert.equal(statement.payerName, 'BDE')
    assert.lengthOf(statement.categories, 1)
    assert.equal(statement.categories[0].label, 'Staff BDE')
    assert.deepEqual(statement.categories[0].lines, [
      {
        productName: 'Burger & frites',
        quantity: 2,
        listPriceCents: BURGER_CENTS,
        paidPriceCents: 100,
        dueCents: 600,
      },
    ])
    assert.equal(statement.dueCents, 600)
  })

  test('sépare deux prix payés du même article dans une même catégorie', async ({ assert }) => {
    const { event, burger, category } = await seed()
    await order(event.id, category.id, burger.id, 2, 100)
    await order(event.id, category.id, burger.id, 1, 200)

    const statement = await receivablesForEvent(event.id)

    // Les fondre en un prix moyen produirait un document indéfendable.
    assert.lengthOf(statement.categories[0].lines, 2)
    assert.equal(statement.dueCents, 600 + 200)
  })

  test('exclut les annulées et les commandes sans catégorie', async ({ assert }) => {
    const { event, burger, category } = await seed()
    await order(event.id, category.id, burger.id, 1, 0, 'cancelled')
    await order(event.id, null, burger.id, 3, BURGER_CENTS)

    const statement = await receivablesForEvent(event.id)
    assert.lengthOf(statement.categories, 0)
    assert.equal(statement.dueCents, 0)
  })

  test('conserve une ligne dont rien n’est dû', async ({ assert }) => {
    const { event, burger, category } = await seed()
    await order(event.id, category.id, burger.id, 2, BURGER_CENTS)

    const statement = await receivablesForEvent(event.id)
    assert.lengthOf(statement.categories[0].lines, 1)
    assert.equal(statement.categories[0].lines[0].dueCents, 0)
  })

  test('échappe le nom d’un article et nomme le payeur manquant', async ({ assert }) => {
    const html = buildReceivablesHtml({
      eventId: 1,
      eventName: 'Soirée',
      payerName: null,
      categories: [
        {
          label: 'Staff BDE',
          lines: [
            {
              productName: 'Burger & frites',
              quantity: 1,
              listPriceCents: 400,
              paidPriceCents: 0,
              dueCents: 400,
            },
          ],
          dueCents: 400,
        },
      ],
      dueCents: 400,
    })

    assert.include(html, 'Burger &amp; frites')
    assert.include(html, 'payeur non renseigné')
    assert.include(html, "n'est pas une facture")
  })

  test('rend un PDF sur la route dédiée', async ({ client, assert }) => {
    const { event, burger, category } = await seed()
    await order(event.id, category.id, burger.id, 1, 0)
    const user = await MemberFactory.create().then((member) =>
      grantPermissions(member, ['order:read'])
    )

    const response = await client.get(`/v1/events/${event.id}/receivables/pdf`).loginAs(user)

    response.assertStatus(200)
    assert.equal(response.header('content-type'), 'application/pdf')
    assert.equal(response.body().subarray(0, 4).toString(), '%PDF')
  })
})
