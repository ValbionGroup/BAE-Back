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
  await Client.create({ id: user.id, promotion: null, registeredAt: DateTime.now() })
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

  /**
   * Le défaut visé, et la moitié « avant paiement » de la tâche 47 : rien
   * n'empêchait un compte de repasser commande autant de fois qu'il voulait sur
   * la même soirée. Le refus doit tomber **ici**, avant que Lydia ne débite —
   * après, il n'y a plus de bon geste possible.
   */
  test('un compte ne peut pas ouvrir une seconde précommande sur la même soirée', async ({
    client: httpClient,
  }) => {
    const user = await makeClient('double@test.fr')
    const { event, product } = await makeEvent(6, 350)

    const first = await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 1 }] })
      .loginAs(user)
    const orderRef = (first.body() as { data: { order_ref: string } }).data.order_ref
    await httpClient.post(`/v1/lydia/callback/${orderRef}`).json({})

    const second = await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 1 }] })
      .loginAs(user)

    second.assertStatus(422)
  })

  /**
   * Le pendant du test précédent : une précommande annulée libère la place.
   * `placedCounts` ne compte déjà pas les annulées — l'unicité doit dire la
   * même chose qu'elles, sans quoi une annulation bannirait le client de la
   * soirée.
   */
  test('une précommande annulée laisse le compte en repasser une', async ({
    client: httpClient,
  }) => {
    const user = await makeClient('annulee@test.fr')
    const { event, product } = await makeEvent(6, 350)

    const first = await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 1 }] })
      .loginAs(user)
    const orderRef = (first.body() as { data: { order_ref: string } }).data.order_ref
    await httpClient.post(`/v1/lydia/callback/${orderRef}`).json({})

    await db.from('pre_orders').where('user_id', user.id).update({ status: 'cancelled' })

    const second = await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 1 }] })
      .loginAs(user)

    second.assertStatus(200)
  })

  /**
   * Le défaut visé, et la course que le contrôle d'ouverture ne peut pas
   * attraper : deux paiements ouverts **avant** que l'un des deux soit
   * confirmé. Aucun des deux devis ne voit l'autre ; seul l'encaissement peut
   * les départager.
   *
   * Le verrou n'est pas éprouvé en concurrence réelle ici — sous
   * `withGlobalTransaction()` deux connexions ne sont pas exprimables (tâche
   * 67). Ce que ce test fige, c'est le résultat : une seule précommande, et le
   * second callback ne part pas en erreur — sinon le webhook Lydia serait
   * rejoué en boucle.
   */
  test('deux paiements ouverts en parallèle ne font qu’une précommande', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('course@test.fr')
    const { event, product } = await makeEvent(6, 350)

    const open = () =>
      httpClient
        .post('/v1/account/pre-orders')
        .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 1 }] })
        .loginAs(user)

    const first = await open()
    const second = await open()
    first.assertStatus(200)
    second.assertStatus(200)

    const refs = [first, second].map(
      (response) => (response.body() as { data: { order_ref: string } }).data.order_ref
    )

    for (const ref of refs) {
      const callback = await httpClient.post(`/v1/lydia/callback/${ref}`).json({})
      callback.assertStatus(204)
    }

    assert.lengthOf(await db.from('pre_orders').where('user_id', user.id), 1)

    // Les deux paiements sont soldés : aucun ne reste `pending`, donc aucun
    // rejeu de webhook en attente.
    const payments = await db.from('payments').whereIn('order_ref', refs)
    assert.lengthOf(payments, 2)
    for (const payment of payments) {
      assert.notEqual(payment.status, 'pending')
    }
  })

  /**
   * La tâche 46, au niveau où elle tient vraiment : l'index. Le contrôle
   * applicatif se contourne par un autre chemin d'écriture ; la base, non.
   */
  test('la base refuse deux précommandes vivantes pour le même compte', async ({ assert }) => {
    const user = await makeClient('index@test.fr')
    const { event } = await makeEvent(6, 350)
    const now = DateTime.now().toSQL()

    const row = () => ({
      user_id: user.id,
      event_id: event.id,
      status: 'pending',
      discount_percent: 0,
      created_at: now,
    })

    await db.table('pre_orders').insert(row())

    // Une annulée cohabite : c'est l'index partiel qui le permet. Vérifié
    // **avant** le rejet, et non après : une erreur Postgres avorte la
    // transaction, et `withGlobalTransaction()` en enveloppe tout le test —
    // le moindre ordre qui suivrait le rejet serait ignoré.
    await db.table('pre_orders').insert({ ...row(), status: 'cancelled' })
    assert.lengthOf(await db.from('pre_orders').where('user_id', user.id), 2)

    await assert.rejects(() => db.table('pre_orders').insert(row()))
  })

  /**
   * Le défaut visé : `pre_order_items` a pour clé primaire
   * `(pre_order_id, product_id)`. Deux lignes du même produit faisaient donc
   * échouer l'insert **au callback**, c'est-à-dire une fois le client débité —
   * paiement encaissé, précommande inexistante.
   */
  test('deux lignes du même produit ne font qu’une, après encaissement', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('merge@test.fr')
    const { event, product } = await makeEvent(6, 350)

    const opened = await httpClient
      .post('/v1/account/pre-orders')
      .json({
        eventId: event.id,
        lines: [
          { productId: product.id, quantity: 2 },
          { productId: product.id, quantity: 3 },
        ],
      })
      .loginAs(user)

    opened.assertStatus(200)
    const body = opened.body() as { data: { order_ref: string; amount_cents: number } }
    // 5 × 350 = 1750, moins 10 % de remise de précommande.
    assert.equal(body.data.amount_cents, 1575)

    await httpClient.post(`/v1/lydia/callback/${body.data.order_ref}`).json({})

    const rows = await db.from('pre_orders').where('user_id', user.id)
    assert.lengthOf(rows, 1)

    const items = await db.from('pre_order_items').where('pre_order_id', rows[0].id)
    assert.lengthOf(items, 1)
    assert.equal(Number(items[0].quantity), 5)
  })

  /** Le plafond par ligne se contournerait sinon en scindant la commande. */
  test('le plafond par article résiste au découpage en plusieurs lignes', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('cap@test.fr')
    const { event, product } = await makeEvent(6, 350)

    const response = await httpClient
      .post('/v1/account/pre-orders')
      .json({
        eventId: event.id,
        lines: [
          { productId: product.id, quantity: 40 },
          { productId: product.id, quantity: 20 },
        ],
      })
      .loginAs(user)

    response.assertStatus(422)
    assert.equal(
      (response.body() as unknown as { error: { code: string } }).error.code,
      'E_PRE_ORDER_QUANTITY_TOO_HIGH'
    )
  })

  /**
   * Le client choisit son créneau, mais pas n'importe lequel : il doit tomber
   * sur un quart d'heure de la soirée, sinon le staff ne pourrait ni le
   * proposer ni le reprendre depuis son écran.
   */
  test('un créneau de retrait hors quart d’heure est refusé', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('slot@test.fr')
    const { event, product } = await makeEvent(6, 350)

    const response = await httpClient
      .post('/v1/account/pre-orders')
      .json({
        eventId: event.id,
        // Ancré sur l'heure pleine puis décalé de 7 min : la date de la soirée
        // est posée à `now + 18 h`, donc à des minutes quelconques.
        pickupAt: event.date.startOf('hour').plus({ hours: 1, minutes: 7 }).toISO(),
        lines: [{ productId: product.id, quantity: 1 }],
      })
      .loginAs(user)

    response.assertStatus(422)
    assert.equal(
      (response.body() as unknown as { error: { code: string } }).error.code,
      'E_PICKUP_SLOT_MISALIGNED'
    )
  })

  test('un créneau de retrait aligné est conservé jusqu’à la précommande', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('slot-ok@test.fr')
    const { event, product } = await makeEvent(6, 350)
    // Idem : on repart de l'heure pleine, sinon le créneau hérite des minutes
    // arbitraires de `now + 18 h` et tombe hors quart d'heure.
    const pickupAt = event.date.startOf('hour').plus({ hours: 1 })

    const opened = await httpClient
      .post('/v1/account/pre-orders')
      .json({
        eventId: event.id,
        pickupAt: pickupAt.toISO(),
        lines: [{ productId: product.id, quantity: 1 }],
      })
      .loginAs(user)

    opened.assertStatus(200)
    const orderRef = (opened.body() as { data: { order_ref: string } }).data.order_ref
    await httpClient.post(`/v1/lydia/callback/${orderRef}`).json({})

    const [row] = await db.from('pre_orders').where('user_id', user.id)
    assert.equal(DateTime.fromJSDate(new Date(row.pickup_at)).toMillis(), pickupAt.toMillis())
  })

  /**
   * Le défaut visé : relire le prix depuis le menu courant, si bien que
   * retoucher le tarif d'une soirée réécrit ce que les clients ont déjà payé.
   */
  test('le prix d’une précommande ne suit pas le menu quand il change', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('figé@test.fr')
    const { event, product } = await makeEvent(6, 350)

    const opened = await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 2 }] })
      .loginAs(user)
    const orderRef = (opened.body() as { data: { order_ref: string } }).data.order_ref
    await httpClient.post(`/v1/lydia/callback/${orderRef}`).json({})

    await db
      .from('event_products')
      .where('event_id', event.id)
      .where('product_id', product.id)
      .update({ price: 700 })

    const listed = await httpClient.get('/v1/account/pre-orders').loginAs(user)
    const [view] = (listed.body() as { data: { subtotal_cents: number; total_cents: number }[] })
      .data

    assert.equal(view.subtotal_cents, 700, 'le sous-total reste celui du jour de l’achat')
    assert.equal(view.total_cents, 630, 'le total reste ce qui a été encaissé')
  })

  /**
   * Le défaut visé, distinct du précédent : afficher le sous-total public en
   * guise de total, donc annoncer au client plus que ce qu'il a réellement payé.
   */
  test('le total affiché égale le montant encaissé', async ({ client: httpClient, assert }) => {
    const user = await makeClient('encaissé@test.fr')
    await giveFastPass(user.id)
    const { event, product } = await makeEvent(6, 350)

    const opened = await httpClient
      .post('/v1/account/pre-orders')
      .json({ eventId: event.id, lines: [{ productId: product.id, quantity: 2 }] })
      .loginAs(user)
    const orderRef = (opened.body() as { data: { order_ref: string } }).data.order_ref
    await httpClient.post(`/v1/lydia/callback/${orderRef}`).json({})

    const payment = await Payment.findByOrFail('orderRef', orderRef)
    const listed = await httpClient.get('/v1/account/pre-orders').loginAs(user)
    const [view] = (listed.body() as { data: { discount_percent: number; total_cents: number }[] })
      .data

    assert.equal(view.total_cents, payment.amountCents)
    assert.equal(view.discount_percent, 15, 'la remise appliquée reste lisible sur la précommande')
  })

  /**
   * Le défaut visé : un `* 100` resté de l'époque où les montants étaient en
   * euros. Depuis le passage aux centimes entiers du 2026-08-25,
   * `fast_passes.price` **est** déjà en centimes — le multiplier à nouveau
   * présentait une cotisation à 12 € comme 1 200 € sur la page Lydia.
   *
   * L'assertion porte sur ce que reçoit le client Lydia, et non sur la réponse
   * de l'API : c'est le montant transmis qui était faux.
   */
  test('la cotisation part chez Lydia au prix exact de la formule', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('cotisation@test.fr')
    const formula = await FastPass.create({
      label: 'Année',
      price: 1200,
      duration: 1,
      description: null,
    })

    const response = await httpClient
      .post('/v1/account/subscriptions')
      .json({ fastPassId: formula.id })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(lydia.created[0].amountCents, 1200)
  })
})
