import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import Client from '#models/client'
import FastPass from '#models/fast_pass'
import Payment from '#models/payment'
import User from '#models/user'
import LydiaClient from '#services/lydia/lydia_client'
import FakeLydiaClient from '#services/lydia/fake_lydia_client'
import { MemberFactory } from '#database/factories/members_factory'

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

function makeFastPass(priceEuros: number): Promise<FastPass> {
  return FastPass.create({
    label: 'Année',
    price: priceEuros,
    duration: 1,
    description: null,
  })
}

test.group('Cotisation payée en ligne', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    app.container.swap(LydiaClient, () => new FakeLydiaClient())
    return () => app.container.restore(LydiaClient)
  })

  /**
   * Le défaut visé : facturer autre chose que le tarif en base, typiquement en
   * acceptant un montant envoyé par le client.
   */
  test('le montant facturé est le tarif de la formule, en centimes', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('a@test.fr')
    const formula = await makeFastPass(15)

    const response = await httpClient
      .post('/v1/account/subscriptions')
      .json({ fastPassId: formula.id, amountCents: 1 })
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body() as { data: { amount_cents: number; mobile_url: string } }
    assert.equal(body.data.amount_cents, 1500)
    assert.isString(body.data.mobile_url)
  })

  /**
   * Le défaut visé : la contrepartie créée à l'initiation du paiement. Une
   * cotisation ouverte mais impayée donnerait un droit d'accès gratuit.
   */
  test('aucune cotisation n’existe tant que le paiement n’est pas confirmé', async ({
    client: httpClient,
    assert,
  }) => {
    const user = await makeClient('b@test.fr')
    const formula = await makeFastPass(15)

    await httpClient
      .post('/v1/account/subscriptions')
      .json({ fastPassId: formula.id })
      .loginAs(user)

    assert.lengthOf(await db.from('subscriptions').where('user_id', user.id), 0)
    assert.lengthOf(await Payment.query().where('userId', user.id).where('status', 'pending'), 1)
  })

  /**
   * Le défaut visé : la route ouverte à tout compte authentifié. Un membre sans
   * ligne `clients` n'est pas un acheteur de la zone publique.
   */
  test('un compte sans ligne clients est refusé', async ({ client: httpClient }) => {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    const formula = await makeFastPass(15)

    const response = await httpClient
      .post('/v1/account/subscriptions')
      .json({ fastPassId: formula.id })
      .loginAs(user)

    response.assertStatus(403)
  })

  test('une formule inexistante est refusée', async ({ client: httpClient }) => {
    const user = await makeClient('c@test.fr')

    const response = await httpClient
      .post('/v1/account/subscriptions')
      .json({ fastPassId: 9999 })
      .loginAs(user)

    response.assertStatus(404)
  })
})
