import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Payment from '#models/payment'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

async function makePayment(attrs: { orderRef: string; status: string; reference: string | null }) {
  const user = await User.create({
    email: `${attrs.orderRef}@test.fr`,
    password: 'secret-de-test',
    casId: `cas-${attrs.orderRef}`,
    firstName: 'Camille',
    lastName: 'Renard',
  })

  return Payment.create({
    provider: 'lydia',
    status: attrs.status,
    orderRef: attrs.orderRef,
    amountCents: 1500,
    currency: 'EUR',
    userId: user.id,
    kind: 'pre_order',
    intent: '{}',
    providerReference: attrs.reference,
    expiresAt: DateTime.now().plus({ minutes: 15 }),
  })
}

test.group('Paiements — liste staff', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * Le défaut visé : une route d'argent gardée par `auth()` seul. La liste dit
   * qui a payé quoi et combien — la donner à tout membre authentifié, c'est la
   * publier.
   */
  test('refuse un membre sans payment:read', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    const response = await client.get('/v1/payments').loginAs(user)
    response.assertStatus(403)
  })

  /**
   * Le défaut visé, distinct : servir la vue **client**, qui ne porte ni la
   * référence du prestataire ni le statut détaillé. Sans eux la page ne peut
   * rien rapprocher d'un relevé Lydia, et c'était tout son objet.
   */
  test('expose la référence du prestataire et le statut', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['payment:read'])
    await makePayment({ orderRef: 'ref-1', status: 'paid', reference: 'lydia-uuid-1' })

    const response = await client.get('/v1/payments').loginAs(user)
    response.assertStatus(200)

    const rows = (
      response.body() as {
        data: { order_ref: string; status: string; provider_reference: string | null }[]
      }
    ).data

    const row = rows.find((entry) => entry.order_ref === 'ref-1')
    assert.equal(row?.status, 'paid')
    assert.equal(row?.provider_reference, 'lydia-uuid-1')
  })
})
