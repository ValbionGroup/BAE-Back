import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { canReadOrders, ordersChannel } from '#services/orders_realtime'

/**
 * On éprouve la **fonction d'autorisation**, pas le flux SSE de bout en bout.
 *
 * Ouvrir un vrai `EventSource` dans Japa demanderait de tenir une connexion
 * longue durée, ce qui rend la suite lente et intermittente en CI pour ne
 * vérifier que du transport fourni par la bibliothèque. Ce qui nous appartient —
 * et donc ce qui peut casser — est la règle d'accès, testée ici directement.
 * L'absence de test de flux est délibérée, pas un oubli.
 */
test.group('Canal temps réel des commandes', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un canal par soirée', ({ assert }) => {
    assert.equal(ordersChannel(4), 'events/4/orders')
  })

  test('refuse une connexion sans utilisateur', async ({ assert }) => {
    assert.isFalse(await canReadOrders(undefined))
  })

  test('refuse un membre sans order:read', async ({ assert }) => {
    const member = await MemberFactory.create()
    await grantPermissions(member, ['order:write'])

    // `order:write` seule ne suffit pas : lire la file est un droit distinct.
    assert.isFalse(await canReadOrders(member.id))
  })

  test('accepte un membre porteur de order:read', async ({ assert }) => {
    const member = await MemberFactory.create()
    await grantPermissions(member, ['order:read'])

    assert.isTrue(await canReadOrders(member.id))
  })

  test('refuse un identifiant qui ne correspond à aucun membre', async ({ assert }) => {
    assert.isFalse(await canReadOrders(999999))
  })
})
