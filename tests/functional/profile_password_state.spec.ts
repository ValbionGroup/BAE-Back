import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'

/**
 * `users.password` est nullable depuis le SSO : un compte provisionné par
 * Keycloak n'en a aucun, et rien ne lui en donnera jamais. L'écran Sécurité s'y
 * fie pour taire son panneau de changement de mot de passe, qui n'aboutirait
 * jamais pour un tel compte.
 *
 * Le booléen est dérivé, jamais la colonne : le front a besoin de savoir *si*
 * un mot de passe existe, jamais lequel.
 */
test.group('Profil — état du mot de passe', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('le profil dit si le compte a un mot de passe : {label}')
    .with([
      { label: 'un compte local en a un', password: 'secret-de-test', expected: true },
      { label: 'un compte né du SSO n’en a aucun', password: null, expected: false },
    ])
    .run(async ({ client, assert }, { password, expected, label }) => {
      const user = await UserFactory.merge({ password }).create()

      const response = await client.get('/v1/account/profile').loginAs(user)

      response.assertStatus(200)
      const body = response.body() as { data: { user: { has_password: boolean } } }
      assert.equal(body.data.user.has_password, expected, label)
    })

  /**
   * Le garde qui empêche `password` de rejoindre la liste `pick` du
   * transformer : la colonne porte un hash bcrypt, et le profil est lu par les
   * deux zones à chaque démarrage.
   */
  test('le profil n’expose jamais le mot de passe lui-même', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await client.get('/v1/account/profile').loginAs(user)

    response.assertStatus(200)
    const body = response.body() as { data: { user: Record<string, unknown> } }
    assert.notProperty(body.data.user, 'password')
  })
})
