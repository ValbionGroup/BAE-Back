import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import { MemberFactory } from '#database/factories/members_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'
import { grantPermissions } from '#tests/helpers/permissions'

/**
 * Les routes `/v1/vouchers` n'étaient gardées que par `middleware.auth()`, donc
 * n'importe quel membre authentifié pouvait lire tous les bons d'achat. Un bon
 * est un objet **au porteur** : sa valeur est dans sa lecture. C'est la seule
 * exigence de sécurité formulée explicitement par le cahier des charges.
 */
test.group('Vouchers authorization', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * Un utilisateur dont le rôle porte exactement les permissions demandées.
   *
   * ⚠️ Passer par `MemberFactory` et non `UserFactory` : le garde résout
   * `user → member → role`, donc un utilisateur sans ligne `members` est refusé
   * quoi qu'il porte — le cas « aucune permission » ne prouverait alors rien.
   */
  async function userWith(permissions: string[]) {
    const member = await MemberFactory.create()
    return grantPermissions(member, permissions)
  }

  test('refuses to list vouchers without voucher:read', async ({ client, assert }) => {
    const user = await userWith([])

    const response = await client.get('/v1/vouchers').loginAs(user)

    response.assertStatus(403)
    // Asserter le corps et pas seulement le statut : une `Exception` nue
    // conserverait le statut mais son corps deviendrait E_INTERNAL_SERVER_ERROR.
    assert.equal(response.body().error.code, 'E_FORBIDDEN')
    assert.include(response.body().error.message, 'voucher:read')
  })

  test('lists vouchers with voucher:read', async ({ client }) => {
    const user = await userWith(['voucher:read'])

    const response = await client.get('/v1/vouchers').loginAs(user)

    response.assertStatus(200)
  })

  test('refuses to create a voucher with voucher:read alone', async ({ client, assert }) => {
    const user = await userWith(['voucher:read'])
    const supplier = await SupplierFactory.create()

    const response = await client
      .post('/v1/vouchers')
      .json({ supplier_id: supplier.id, value: 10, expires_at: '2026-12-31', condition: null })
      .loginAs(user)

    // Lire n'autorise pas à écrire : c'est tout l'intérêt d'avoir deux
    // permissions plutôt qu'une.
    response.assertStatus(403)
    assert.include(response.body().error.message, 'voucher:write')
  })

  test('creates a voucher with voucher:write', async ({ client }) => {
    const user = await userWith(['voucher:write'])
    const supplier = await SupplierFactory.create()

    const response = await client
      .post('/v1/vouchers')
      .json({ supplier_id: supplier.id, value: 10, expires_at: '2026-12-31', condition: null })
      .loginAs(user)

    response.assertStatus(200)
  })

  test('refuses to consume a voucher without voucher:write', async ({ client }) => {
    const user = await userWith(['voucher:read'])
    const response = await client
      .patch('/v1/vouchers/1')
      .json({ used_at: DateTime.now().toISO() })
      .loginAs(user)

    // Le garde passe **avant** le contrôleur : l'id inexistant n'est jamais
    // atteint, donc c'est bien 403 et non 404 qu'on attend ici.
    response.assertStatus(403)
  })

  test('refuses to delete a voucher without voucher:write', async ({ client }) => {
    const user = await userWith(['voucher:read'])
    const response = await client.delete('/v1/vouchers/1').loginAs(user)

    // Même garde que pour PATCH : il passe avant le contrôleur, donc l'id
    // inexistant n'est jamais atteint et c'est bien 403 et non 404 qu'on attend ici.
    response.assertStatus(403)
  })
})
