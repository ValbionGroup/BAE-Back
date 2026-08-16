import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { SESSION_COOKIE } from '#services/session_cookie'

/**
 * ⚠️ Le cœur du mode BFF : le navigateur n'envoie **aucun en-tête** — il porte un
 * cookie `httpOnly` que le JavaScript du front ne peut pas lire. Si le back
 * cesse d'accepter ce cookie, tout le dashboard se déconnecte sans qu'aucun
 * autre test ne le voie, puisqu'ils passent tous par `loginAs()`.
 */
test.group('Authentification par cookie', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function passwordLogin(client: ApiClient) {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    user.password = 'secret-de-test'
    await user.save()
    await grantPermissions(member, ['member:read'])

    return client.post('/v1/auth/login').json({ email: user.email, password: 'secret-de-test' })
  }

  test('la connexion par mot de passe pose le cookie de session', async ({ client, assert }) => {
    const response = await passwordLogin(client)

    response.assertStatus(200)
    const cookie = response.cookie(SESSION_COOKIE)
    assert.isDefined(cookie, 'le cookie de session doit être posé')
    assert.isTrue(cookie!.httpOnly, 'un jeton lisible en JavaScript serait exfiltrable par XSS')
  })

  test('le cookie seul authentifie, sans en-tête Authorization', async ({ client, assert }) => {
    const login = await passwordLogin(client)
    const token = login.cookie(SESSION_COOKIE)!.value

    const response = await client.get('/v1/members').withCookie(SESSION_COOKIE, token)

    assert.notEqual(response.status(), 401, 'le cookie doit suffire à authentifier')
  })

  test('sans cookie ni en-tête, l’accès est refusé', async ({ client }) => {
    const response = await client.get('/v1/members')

    response.assertStatus(401)
  })

  test('la déconnexion efface le cookie', async ({ client, assert }) => {
    const login = await passwordLogin(client)
    const token = login.cookie(SESSION_COOKIE)!.value

    const response = await client.post('/v1/auth/logout').withCookie(SESSION_COOKIE, token)

    response.assertStatus(204)
    const cleared = response.cookie(SESSION_COOKIE)
    // Un cookie effacé est renvoyé vide et/ou expiré — dans les deux cas il ne
    // doit plus porter le jeton.
    assert.notEqual(cleared?.value, token, 'le jeton ne doit plus être présenté')
  })

  test('un en-tête explicite garde la priorité sur le cookie', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['member:read'])

    // `loginAs` pose un en-tête ; un cookie invalide ne doit pas le supplanter,
    // sinon les tests et les scripts d'exploitation casseraient.
    const response = await client
      .get('/v1/members')
      .withCookie(SESSION_COOKIE, 'jeton-invalide')
      .loginAs(user)

    assert.notEqual(response.status(), 401)
  })
})
