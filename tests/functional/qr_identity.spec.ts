import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import FastPass from '#models/fast_pass'
import JwtService from '#services/jwt_service'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { errorCodeOf } from '#tests/helpers/api_error'

async function subscribe(userId: number, label: string, duration: number, startedDaysAgo: number) {
  const pass = await FastPass.create({ label, duration, price: 15, description: null })
  await db.table('subscriptions').insert({
    user_id: userId,
    fast_pass_id: pass.id,
    subscribed_at: DateTime.now().minus({ days: startedDaysAgo }).toSQL({ includeOffset: false }),
    created_at: DateTime.now().toSQL({ includeOffset: false }),
  })
  return pass
}

test.group('QR d’identité — émission et vérification', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('chacun émet son propre QR', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    const response = await client.get('/v1/account/qr').loginAs(user)

    response.assertStatus(200)
    assert.isString(response.body().data.token)
    assert.isString(response.body().data.expires_at)
    // TTL choisi explicitement, contre les 60 s par défaut — voir le contrôleur.
    assert.equal(response.body().data.ttl_seconds, 180)
  })

  test('le comptoir résout un QR en identité', async ({ client, assert }) => {
    const buyer = await MemberFactory.with('user', 1, (u) =>
      u.merge({ firstName: 'Camille', lastName: 'Renard' })
    ).create()
    const cashier = await MemberFactory.create()
    const user = await grantPermissions(cashier, ['order:write'])

    const token = await new JwtService().generateQrToken({ type: 'identity', userId: buyer.id })

    const response = await client.post('/v1/qr/verify').json({ token }).loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.kind, 'buyer')
    assert.equal(response.body().data.buyer.user_id, buyer.id)
    assert.equal(response.body().data.buyer.name, 'Camille Renard')
    assert.isNull(response.body().data.buyer.fast_pass)
  })

  test('remonte le fast pass en cours de validité', async ({ client, assert }) => {
    const buyer = await MemberFactory.create()
    await subscribe(buyer.id, 'Pass Annuel', 1, 10)
    const user = await grantPermissions(await MemberFactory.create(), ['order:write'])

    const token = await new JwtService().generateQrToken({ type: 'identity', userId: buyer.id })
    const response = await client.post('/v1/qr/verify').json({ token }).loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.buyer.fast_pass.label, 'Pass Annuel')
  })

  test('ignore un fast pass échu — la validité est dérivée, pas stockée', async ({
    client,
    assert,
  }) => {
    const buyer = await MemberFactory.create()
    // Souscrit il y a 400 jours pour un an : expiré depuis plus d’un mois.
    await subscribe(buyer.id, 'Pass Annuel', 1, 400)
    const user = await grantPermissions(await MemberFactory.create(), ['order:write'])

    const token = await new JwtService().generateQrToken({ type: 'identity', userId: buyer.id })
    const response = await client.post('/v1/qr/verify').json({ token }).loginAs(user)

    response.assertStatus(200)
    assert.isNull(response.body().data.buyer.fast_pass)
  })

  test('distingue un QR expiré d’un QR invalide', async ({ client, assert }) => {
    const buyer = await MemberFactory.create()
    const user = await grantPermissions(await MemberFactory.create(), ['order:write'])

    // TTL négatif : le jeton naît expiré.
    const expired = await new JwtService().generateQrToken(
      { type: 'identity', userId: buyer.id },
      -10
    )
    const expiredResponse = await client
      .post('/v1/qr/verify')
      .json({ token: expired })
      .loginAs(user)

    expiredResponse.assertStatus(422)
    assert.equal(errorCodeOf(expiredResponse), 'E_QR_EXPIRED')

    const garbageResponse = await client
      .post('/v1/qr/verify')
      .json({ token: 'pas.un.jeton' })
      .loginAs(user)

    garbageResponse.assertStatus(422)
    assert.equal(errorCodeOf(garbageResponse), 'E_QR_INVALID')
  })

  test('un QR de fast pass valide identifie son porteur', async ({ client, assert }) => {
    const buyer = await MemberFactory.with('user', 1, (u) =>
      u.merge({ firstName: 'Tom', lastName: 'Bessiere' })
    ).create()
    const pass = await subscribe(buyer.id, 'Pass Annuel', 1, 10)
    const user = await grantPermissions(await MemberFactory.create(), ['order:write'])

    const token = await new JwtService().generateQrToken({
      type: 'fast_pass',
      userId: buyer.id,
      fastPassId: pass.id,
    })

    const response = await client.post('/v1/qr/verify').json({ token }).loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().data.kind, 'buyer')
    assert.equal(response.body().data.buyer.name, 'Tom Bessiere')
  })

  test('un fast pass echu est refuse, meme signe', async ({ client, assert }) => {
    const buyer = await MemberFactory.create()
    const pass = await subscribe(buyer.id, 'Pass Annuel', 1, 400)
    const user = await grantPermissions(await MemberFactory.create(), ['order:write'])

    const token = await new JwtService().generateQrToken({
      type: 'fast_pass',
      userId: buyer.id,
      fastPassId: pass.id,
    })

    const response = await client.post('/v1/qr/verify').json({ token }).loginAs(user)

    response.assertStatus(422)
    assert.equal(errorCodeOf(response), 'E_FAST_PASS_EXPIRED')
  })

  test('vérifier un QR exige order:write', async ({ client, assert }) => {
    const user = await grantPermissions(await MemberFactory.create(), ['order:read'])

    const response = await client.post('/v1/qr/verify').json({ token: 'peu importe' }).loginAs(user)

    response.assertStatus(403)
    assert.equal(errorCodeOf(response), 'E_FORBIDDEN')
  })
})

test.group('Recherche d’acheteur — le chemin dégradé', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('retrouve une personne par son nom', async ({ client, assert }) => {
    await MemberFactory.with('user', 1, (u) =>
      u.merge({ firstName: 'Camille', lastName: 'Renard' })
    ).create()
    const user = await grantPermissions(await MemberFactory.create(), ['order:write'])

    const response = await client.get('/v1/buyers?q=Renard').loginAs(user)

    response.assertStatus(200)
    const found = response.body().data.find((b: { name: string }) => b.name === 'Camille Renard')
    assert.isDefined(found, 'la recherche doit être atteignable sans le scanner')
  })

  test('exige au moins deux caractères', async ({ client }) => {
    const user = await grantPermissions(await MemberFactory.create(), ['order:write'])

    const response = await client.get('/v1/buyers?q=R').loginAs(user)

    response.assertStatus(422)
  })
})
