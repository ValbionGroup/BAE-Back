import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import Client from '#models/client'
import User from '#models/user'
import { errorCodeOf } from '#tests/helpers/api_error'
import { clearLimits } from '#tests/helpers/limiter'

/**
 * Seuls les membres du bureau définissent une 2FA ou changent leur mot de passe.
 *
 * ⚠️ C'est du **câblage par route**, donc invisible de tout test unitaire : la
 * garde est un middleware posé sur un groupe, et l'oublier sur une seule route
 * n'a aucun symptôme. D'où la table : chaque route ajoutée à la sécurité du compte
 * s'ajoute ici, et rien d'autre n'attrape l'omission.
 *
 * ⚠️ Ne jamais étendre cette table à `/v1/account/profile` ni `/v1/account/qr` :
 * ces deux-là partagent le préfixe mais **doivent** rester ouvertes aux comptes
 * clients, qui sont l'ossature de la zone publique.
 */
test.group('Sécurité du compte — réservée aux membres', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => clearLimits())

  async function makeClient(): Promise<User> {
    const user = await User.create({
      email: 'cliente@bae.test',
      password: 'mot-de-passe-actuel',
      firstName: 'Camille',
      lastName: 'Renard',
    })
    await Client.create({
      id: user.id,
      promotion: null,
      registeredAt: DateTime.now(),
    })
    return user
  }

  test('refuse un compte sans ligne de membre', async ({ client, assert }) => {
    const user = await makeClient()

    const routes: ReadonlyArray<[method: 'put' | 'post', path: string]> = [
      ['put', '/v1/account/password'],
      ['post', '/v1/account/2fa'],
      ['post', '/v1/account/2fa/confirm'],
      ['post', '/v1/account/2fa/recovery-codes'],
      ['post', '/v1/account/2fa/disable'],
    ]

    for (const [method, path] of routes) {
      const response = await client[method](path).loginAs(user).json({})

      assert.equal(response.status(), 403, `${method.toUpperCase()} ${path}`)
      assert.equal(errorCodeOf(response), 'E_FORBIDDEN', `${method.toUpperCase()} ${path}`)
    }
  })
})
