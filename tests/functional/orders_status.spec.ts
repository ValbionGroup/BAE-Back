import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Order from '#models/order'
import { MemberFactory } from '#database/factories/members_factory'

async function makeEvent() {
  return Event.create({
    name: 'Soirée Hivernale',
    description: null,
    date: DateTime.fromISO('2026-02-14'),
    status: 'scheduled',
    duration: 4,
  })
}

test.group('orders — schéma des statuts et de l’acheteur', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('accepte les deux états de cuisine ajoutés', async ({ assert }) => {
    const event = await makeEvent()

    for (const status of ['pending', 'in_progress', 'ready', 'completed', 'cancelled']) {
      const order = await Order.create({ eventId: event.id, status })
      assert.equal(order.status, status)
    }
  })

  test('refuse un statut hors de la liste', async ({ assert }) => {
    const event = await makeEvent()

    // La contrainte est portée par la base (CHECK), pas par une validation
    // applicative : c'est elle qu'on éprouve ici.
    await assert.rejects(() => Order.create({ eventId: event.id, status: 'en_cuisine' }))
  })

  test('client_id accepte null — la commande anonyme est le cas courant', async ({ assert }) => {
    const event = await makeEvent()

    const order = await Order.create({ eventId: event.id, status: 'pending' })

    // Relecture volontaire : après `create()`, l'instance en mémoire ne porte que
    // les colonnes fournies, donc `clientId` y vaut `undefined`. C'est la valeur
    // **persistée** qui nous intéresse.
    const persisted = await Order.findOrFail(order.id)

    assert.isNull(persisted.clientId)
  })

  test('client_id accepte un utilisateur, distinct du membre qui a pris la commande', async ({
    assert,
  }) => {
    const event = await makeEvent()
    const cashier = await MemberFactory.create()
    const buyer = await MemberFactory.create()

    const order = await Order.create({
      eventId: event.id,
      memberId: cashier.id,
      clientId: buyer.id,
      status: 'pending',
    })

    // `members.id` est `users.id` : l'id d'un membre est donc un `client_id`
    // valide sans conversion. Les deux colonnes portent bien deux personnes
    // différentes — qui a encaissé, et qui a acheté.
    assert.equal(order.memberId, cashier.id)
    assert.equal(order.clientId, buyer.id)
    assert.notEqual(order.memberId, order.clientId)
  })
})
