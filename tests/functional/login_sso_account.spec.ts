import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'

/**
 * ⚠️ Un compte né du SSO n'a **pas** de mot de passe. Soumettre son email au
 * formulaire mot-de-passe atteignait `verifyPassword`, documenté comme levant une
 * `RuntimeException` quand la colonne est `null` — donc un **500**, là où un
 * compte inexistant renvoie 400.
 *
 * Deux défauts en un : un plantage, et un **oracle d'énumération de comptes** —
 * la différence de statut permet de distinguer « ce compte existe » de « ce compte
 * n'existe pas ». La réponse doit donc être rigoureusement la même dans les deux
 * cas, pas seulement « ne pas planter ».
 */
test.group('Connexion — comptes sans mot de passe (SSO)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function makeSsoUser(email: string): Promise<void> {
    await db.table('users').insert({
      email,
      password: null,
      cas_id: `uid-${email}`,
      keycloak_sub: `sub-${email}`,
      first_name: 'Sans',
      last_name: 'Motdepasse',
      created_at: new Date(),
      updated_at: new Date(),
    })
  }

  test('ne plante pas quand le compte n’a pas de mot de passe', async ({ client }) => {
    await makeSsoUser('sso@bae.test')

    const response = await client
      .post('/v1/auth/login')
      .json({ email: 'sso@bae.test', password: 'nimportequoi' })

    response.assertStatus(401)
  })

  test('répond exactement comme pour un compte inexistant', async ({ client, assert }) => {
    await makeSsoUser('sso2@bae.test')

    const existing = await client
      .post('/v1/auth/login')
      .json({ email: 'sso2@bae.test', password: 'nimportequoi' })

    const missing = await client
      .post('/v1/auth/login')
      .json({ email: 'personne-ici@bae.test', password: 'nimportequoi' })

    assert.equal(
      existing.status(),
      missing.status(),
      'un statut différent révèle l’existence du compte'
    )
    assert.deepEqual(
      existing.body(),
      missing.body(),
      'un corps différent révèle l’existence du compte'
    )
  })
})
