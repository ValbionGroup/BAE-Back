import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { summaryForEvent } from '#services/event_summary_service'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { ProductFactory } from '#database/factories/product_factory'
import SponsorshipCategory from '#models/sponsorship_category'

test.group('Bilan de soirée', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function menuLine(
    eventId: number,
    productId: number,
    quantity: number,
    priceCents: number
  ) {
    await db.table('event_products').insert({
      event_id: eventId,
      product_id: productId,
      quantity,
      price: priceCents,
      created_at: new Date(),
      updated_at: new Date(),
    })
  }

  /** `priceCents` est figé sur la ligne, comme le fait tout encaissement réel. */
  async function soldOrder(
    eventId: number,
    memberId: number,
    productId: number,
    quantity: number,
    status = 'completed',
    priceCents = 250
  ) {
    const [order] = await db
      .table('orders')
      .insert({
        event_id: eventId,
        member_id: memberId,
        status,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id')

    const orderId = typeof order === 'object' ? Number(order.id) : Number(order)
    await db.table('order_products').insert({
      order_id: orderId,
      product_id: productId,
      quantity,
      unit_price_cents: priceCents,
      list_price_cents: priceCents,
    })
    return orderId
  }

  test('le chiffre d’affaires suit les quantités vendues et le prix du menu', async ({
    assert,
  }) => {
    const event = await EventFactory.merge({ status: 'completed' }).create()
    const member = await MemberFactory.create()
    const product = await ProductFactory.create()

    await menuLine(event.id, product.id, 100, 250)
    await soldOrder(event.id, member.id, product.id, 3)

    const summary = await summaryForEvent(event.id)
    const line = summary.lines.find((entry) => entry.productId === product.id)

    assert.isDefined(line)
    assert.equal(line!.soldQty, 3)
    assert.equal(line!.unitPriceCents, 250)
    assert.equal(line!.revenueCents, 750, '3 × 2,50 € = 7,50 €, exprimé en centimes')
    assert.equal(summary.revenueCents, 750)
  })

  test('une commande annulée ne compte ni en vente ni en volume', async ({ assert }) => {
    const event = await EventFactory.merge({ status: 'completed' }).create()
    const member = await MemberFactory.create()
    const product = await ProductFactory.create()

    await menuLine(event.id, product.id, 100, 250)
    await soldOrder(event.id, member.id, product.id, 5, 'cancelled')

    const summary = await summaryForEvent(event.id)
    const line = summary.lines.find((entry) => entry.productId === product.id)

    assert.equal(line!.soldQty, 0, 'annulée = jamais vendue')
    assert.equal(summary.revenueCents, 0)
    assert.equal(summary.cancelledCount, 1)
    assert.equal(summary.orderCount, 0, 'les annulées sont comptées à part')
  })

  test('l’invendu se mesure sur le produit, pas sur le prévu', async ({ assert }) => {
    const event = await EventFactory.merge({ status: 'completed' }).create()
    const member = await MemberFactory.create()
    const product = await ProductFactory.create()

    await menuLine(event.id, product.id, 200, 250)
    await db.table('production_runs').insert({
      event_id: event.id,
      product_id: product.id,
      member_id: member.id,
      quantity: 50,
      created_at: new Date(),
    })
    await soldOrder(event.id, member.id, product.id, 20)

    const summary = await summaryForEvent(event.id)
    const line = summary.lines.find((entry) => entry.productId === product.id)

    assert.equal(line!.plannedQty, 200)
    assert.equal(line!.producedQty, 50)
    assert.equal(line!.soldQty, 20)
    assert.equal(line!.unsoldQty, 30, 'ce qui reste sur les bras, pas ce qui manque au prévu')
  })

  test('une soirée sans menu rend un bilan vide plutôt qu’une erreur', async ({ assert }) => {
    const event = await EventFactory.merge({ status: 'completed' }).create()

    const summary = await summaryForEvent(event.id)

    assert.lengthOf(summary.lines, 0)
    assert.equal(summary.revenueCents, 0)
    assert.lengthOf(summary.cashedByMethod, 0)
  })

  test('une transaction réglant deux commandes n’est comptée qu’une fois', async ({ assert }) => {
    const event = await EventFactory.merge({ status: 'completed' }).create()
    const member = await MemberFactory.create()
    const product = await ProductFactory.create()
    await menuLine(event.id, product.id, 100, 250)

    const [transaction] = await db
      .table('transactions')
      .insert({
        type: 'cash',
        amount: 1250,
        created_at: DateTime.now().toSQL(),
        updated_at: DateTime.now().toSQL(),
      })
      .returning('id')
    const transactionId =
      typeof transaction === 'object' ? Number(transaction.id) : Number(transaction)

    const first = await soldOrder(event.id, member.id, product.id, 2)
    const second = await soldOrder(event.id, member.id, product.id, 3)
    await db.from('orders').whereIn('id', [first, second]).update({ transaction_id: transactionId })

    const summary = await summaryForEvent(event.id)
    const cash = summary.cashedByMethod.find((entry) => entry.method === 'cash')

    assert.isDefined(cash)
    assert.equal(cash!.count, 1, 'compter par commande la multiplierait')
    assert.strictEqual(cash!.amount, 1250)
    assert.isTrue(Number.isInteger(cash!.amount), 'un montant ne porte jamais de decimale')
  })

  /** Une vente sous prise en charge : `listPrice` est le prix public, `paid` ce
   *  que la personne a réellement sorti. L'écart est ce qui se répartit. */
  async function sponsoredOrder(
    eventId: number,
    productId: number,
    quantity: number,
    mode: 'external' | 'internal',
    label: string,
    listCents: number,
    paidCents: number
  ) {
    const category = await SponsorshipCategory.create({
      eventId,
      label,
      mode,
      qrNonce: `nonce-${label}`,
    })

    const [order] = await db
      .table('orders')
      .insert({
        event_id: eventId,
        status: 'completed',
        sponsorship_category_id: category.id,
        sponsorship_category_label: label,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id')

    await db.table('order_products').insert({
      order_id: typeof order === 'object' ? Number(order.id) : Number(order),
      product_id: productId,
      quantity,
      unit_price_cents: paidCents,
      list_price_cents: listCents,
    })
  }

  test('range l’écart d’une catégorie externe en créance, pas en perte', async ({ assert }) => {
    const event = await EventFactory.create()
    const product = await ProductFactory.create()
    await menuLine(event.id, product.id, 10, 250)
    await sponsoredOrder(event.id, product.id, 4, 'external', 'Staff BDE', 250, 100)

    const summary = await summaryForEvent(event.id)

    assert.equal(summary.revenueCents, 1000)
    assert.equal(summary.cashedCents, 400)
    assert.equal(summary.receivableCents, 600)
    assert.equal(summary.grantedCents, 0)
    // Rien n'est perdu : le BDE doit les 600, donc le CA net ne bouge pas.
    assert.equal(summary.netRevenueCents, 1000)
    assert.deepEqual(summary.receivableByCategory, [{ label: 'Staff BDE', dueCents: 600 }])
    assert.deepEqual(summary.grantedByCategory, [])
  })

  test('range l’écart d’une catégorie interne en perte, et ampute le CA net', async ({
    assert,
  }) => {
    const event = await EventFactory.create()
    const product = await ProductFactory.create()
    await menuLine(event.id, product.id, 10, 250)
    await sponsoredOrder(event.id, product.id, 4, 'internal', 'Invités du BAE', 250, 100)

    const summary = await summaryForEvent(event.id)

    assert.equal(summary.revenueCents, 1000, 'le brut ne bouge pas : un bilan imprimé reste juste')
    assert.equal(summary.receivableCents, 0)
    assert.equal(summary.grantedCents, 600)
    assert.equal(summary.netRevenueCents, 400, 'le BAE ne touchera jamais les 600 offerts')
    assert.deepEqual(summary.receivableByCategory, [])
    assert.deepEqual(summary.grantedByCategory, [{ label: 'Invités du BAE', grantedCents: 600 }])
  })

  test('sépare les deux natures quand elles coexistent', async ({ assert }) => {
    const event = await EventFactory.create()
    const member = await MemberFactory.create()
    const product = await ProductFactory.create()
    await menuLine(event.id, product.id, 30, 250)

    await sponsoredOrder(event.id, product.id, 4, 'external', 'Staff BDE', 250, 100)
    await sponsoredOrder(event.id, product.id, 2, 'internal', 'Invités du BAE', 250, 0)
    // Une vente ordinaire : sans elle, rien ne prouverait que la jointure sur
    // les catégories n'écarte pas les commandes qui n'en ont aucune.
    await soldOrder(event.id, member.id, product.id, 3)

    const summary = await summaryForEvent(event.id)

    assert.equal(summary.revenueCents, 2250, '(4 + 2 + 3) × 2,50 €')
    assert.equal(summary.receivableCents, 600)
    assert.equal(summary.grantedCents, 500)
    assert.equal(summary.sponsoredCents, 1100)
    assert.equal(summary.netRevenueCents, 1750)
  })
})
