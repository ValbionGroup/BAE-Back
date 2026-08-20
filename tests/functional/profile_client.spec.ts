import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import Client from '#models/client'
import { SESSION_COOKIE } from '#services/session_cookie'

/**
 * Le front public appelle `/v1/account/profile` **au démarrage**, avec un compte
 * qui n'a aucune ligne `members` : la zone publique n'en exige pas, et le
 * provisionnement SSO ne crée qu'une ligne `clients`.
 *
 * Toutes les couvertures existantes de cet endpoint partent de `MemberFactory`
 * (`profile_permissions.spec.ts`), donc ce chemin-là n'était vérifié nulle part.
 * S'il rendait 500, la toute première requête du front public échouerait.
 */
test.group('Profil — compte sans ligne membre', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un client authentifié obtient son profil, sans 500', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await Client.create({ id: user.id, registeredAt: DateTime.now() })

    const response = await client.get('/v1/account/profile').loginAs(user)

    response.assertStatus(200)
    const body = response.body() as {
      data: { user: { id: number }; member: unknown; permissions: string[] }
    }
    assert.equal(body.data.user.id, user.id)
    // Pas de membre, donc aucune permission de staff — surtout pas une erreur.
    assert.deepEqual(body.data.permissions, [])
  })

  test('un utilisateur sans membre ni client obtient aussi son profil', async ({ client }) => {
    const user = await UserFactory.create()

    // `/v1/account` est délibérément hors garde d'audience : un client a lui
    // aussi un profil. Le contrôleur doit donc tolérer l'absence de membre.
    const response = await client.get('/v1/account/profile').loginAs(user)

    response.assertStatus(200)
  })
})

test.group('Cookie de session — portée', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * `COOKIE_DOMAIN` est vide en développement et en test : le cookie doit rester
   * *host-only*. Le régler à `undefined` plutôt que de l'omettre ferait
   * sérialiser `Domain=undefined` par certaines piles, et le cookie serait perdu.
   */
  test('sans COOKIE_DOMAIN, le cookie ne porte aucun domaine', async ({ client, assert }) => {
    const user = await UserFactory.create()
    user.password = 'secret-de-test'
    await user.save()

    const response = await client
      .post('/v1/auth/login')
      .json({ email: user.email, password: 'secret-de-test' })

    response.assertStatus(200)
    const cookie = response.cookie(SESSION_COOKIE)
    assert.isDefined(cookie)
    assert.notProperty(cookie!, 'domain')
  })
})
