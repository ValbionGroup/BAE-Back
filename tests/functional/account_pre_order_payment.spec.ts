import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import Client from '#models/client'
import type Event from '#models/event'
import FastPass from '#models/fast_pass'
import Payment from '#models/payment'
import type Product from '#models/product'
import User from '#models/user'
import LydiaClient from '#services/lydia/lydia_client'
import FakeLydiaClient from '#services/lydia/fake_lydia_client'
import { EventFactory } from '#database/factories/event_factory'
import { ProductFactory } from '#database/factories/product_factory'

const CLOSE_LEAD_HOURS = 12

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

/**
 * Une soirée dont les précommandes ferment dans `hoursUntilClose` heures.
 *
 * Le délai de clôture est posé **sur la soirée** plutôt que laissé à la valeur
 * globale : sans ça, le test dépendrait de `PRE_ORDER_CLOSE_LEAD_HOURS`, donc de
 * l'environnement de qui l'exécute.
 */
async function makeEvent(
  hoursUntilClose: number,
  priceCents: number
): Promise<{ event: Event; product: Product }> {
  const event = await EventFactory.merge({
    date: DateTime.now().plus({ hours: hoursUntilClose + CLOSE_LEAD_HOURS }),
    status: 'scheduled',
    capacity: 100,
    preOrderCloseLeadHours: CLOSE_LEAD_HOURS,
  }).create()

  const product = await ProductFactory.create()
  await event.related('products').attach({ [product.id]: { price: priceCents } })

  return { event, product }
}

/** Une adhésion en cours de validité pour ce porteur. */
async function giveFastPass(userId: number): Promise<void> {
  const pass = await FastPass.create({
    label: 'Année',
    price: 15,
    duration: 1,
    description: null,
  })

  const now = DateTime.now()
  await db.table('subscriptions').insert({
    user_id: userId,
    fast_pass_id: pass.id,
    subscribed_at: now.toSQL(),
    transaction_id: null,
    created_at: now.toSQL(),
    updated_at: now.toSQL(),
  })
}

test.group('Précommande payée en ligne', (group) => {
  let lydia: FakeLydiaClient

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    lydia = new FakeLydiaClient()
    app.container.swap(LydiaClient, () => lydia)
    return () => app.container.restore(LydiaClient)
  })

  /**
   * Le défaut visé : facturer le sous-total sans la remise annoncée sur la page
   * publique.
   */
  test('le montant facturé applique la remise de précommande', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('a@test.fr')
    const { event, product } = await makeEvent(6, 350)

    const response = await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 2 }] })
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body() as { data: { amount_cents: number } }
    // 700 centimes moins 10 % de remise de précommande.
    assert.equal(body.data.amount_cents, 630)
  })

  /**
   * Le défaut visé, distinct du précédent : oublier le bonus adhérent, et donc
   * surfacturer précisément ceux à qui la page Fastpass l'a promis.
   */
  test('un adhérent bénéficie du bonus qui s’ajoute à la remise', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('bonus@test.fr')
    await giveFastPass(user.id)
    const { event, product } = await makeEvent(6, 350)

    const response = await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 2 }] })
      .loginAs(user)

    const body = response.body() as { data: { amount_cents: number } }
    // 700 centimes moins 10 % + 5 %.
    assert.equal(body.data.amount_cents, 595)
  })

  /**
   * Le défaut visé : un libellé générique. Le client lit ce texte sur la page
   * Lydia puis sur son relevé — sans le nom de la soirée, deux précommandes de
   * deux soirées différentes sont indiscernables.
   */
  test('le libellé du paiement nomme la soirée', async ({ client: httpClient, assert }) => {
    const user = await makeClient('libelle@test.fr')
    const { event, product } = await makeEvent(6, 350)

    await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 1 }] })
      .loginAs(user)

    assert.include(lydia.created[0].message, event.name)
  })

  /**
   * Le défaut visé : une demande de paiement qui survit à la clôture des
   * précommandes. Confirmée après coup, elle encaisserait une commande que la
   * cuisine ne peut plus produire.
   */
  test('la demande expire avant la clôture des précommandes', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('b@test.fr')
    const { event, product } = await makeEvent(0.1, 350)

    await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 1 }] })
      .loginAs(user)

    // 0,1 h ≈ 360 s : la fenêtre nominale de 900 s doit avoir été rabotée.
    assert.isBelow(lydia.created[0].expireTimeSeconds, 360)
    assert.isAbove(lydia.created[0].expireTimeSeconds, 0)
  })

  test('une soirée déjà fermée refuse la précommande', async ({ client: httpClient }) => {
    const user = await makeClient('c@test.fr')
    const { event, product } = await makeEvent(-1, 350)

    const response = await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 1 }] })
      .loginAs(user)

    response.assertStatus(422)
  })

  /**
   * Le défaut visé : accepter un produit absent du menu de la soirée, et donc
   * facturer un prix qui n'existe pas pour elle.
   */
  test('un produit hors du menu de la soirée est refusé', async ({ client: httpClient }) => {
    const user = await makeClient('d@test.fr')
    const { event } = await makeEvent(6, 350)
    const intruder = await ProductFactory.create()

    const response = await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: intruder.id, quantity: 1 }] })
      .loginAs(user)

    response.assertStatus(422)
  })

  /**
   * Le défaut visé : la précommande créée à l'initiation, donc produite en
   * cuisine sans avoir été payée.
   */
  test('la précommande naît à la confirmation, pas à l’ouverture du paiement', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('e@test.fr')
    const { event, product } = await makeEvent(6, 350)

    const opened = await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 2 }] })
      .loginAs(user)
    const orderRef = (opened.body() as { data: { order_ref: string } }).data.order_ref

    assert.lengthOf(await db.from('pre_orders').where('user_id', user.id), 0)

    await httpClient.post(`/v1/lydia/callback/${orderRef}`).json({})

    const rows = await db.from('pre_orders').where('user_id', user.id)
    assert.lengthOf(rows, 1)

    const payment = await Payment.findByOrFail('orderRef', orderRef)
    assert.equal(rows[0].transaction_id, payment.transactionId)

    const items = await db.from('pre_order_items').where('pre_order_id', rows[0].id)
    assert.lengthOf(items, 1)
    assert.equal(Number(items[0].quantity), 2)
  })
})
