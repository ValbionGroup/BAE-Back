import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import Client from '#models/client'
import PasswordResetToken from '#models/password_reset_token'
import { MemberFactory } from '#database/factories/members_factory'
import { PasswordResetNotification } from '#mails/password_reset_notification'
import { errorCodeOf } from '#tests/helpers/api_error'

const CURRENT = 'mot-de-passe-actuel'
const NEXT = 'NouveauMotDePasse1'

type Fake = ReturnType<typeof mail.fake>

test.group('Mot de passe oublié', (group) => {
  let fake: Fake

  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    fake = mail.fake()
    return () => mail.restore()
  })

  /**
   * ⚠️ L'adresse vient toujours de la factory, jamais d'une constante : le
   * seeder de développement occupe déjà `membre@bae.test` et compagnie, et
   * `users.email` est unique. Une adresse en dur ici échoue à l'insertion, sur une
   * base de développement, avant même d'avoir testé quoi que ce soit.
   */
  async function memberWithPassword(): Promise<User> {
    const member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    user.password = CURRENT
    await user.save()
    return user
  }

  async function memberWithoutPassword(): Promise<User> {
    const user = await memberWithPassword()
    user.password = null
    await user.save()
    return user
  }

  async function clientAccount(): Promise<User> {
    const user = await User.create({
      email: `reset-cliente-${Date.now()}@example.test`,
      password: CURRENT,
      firstName: 'Camille',
      lastName: 'Renard',
    })
    await Client.create({ id: user.id, phone: null, promotion: null, registeredAt: DateTime.now() })
    return user
  }

  /**
   * ⚠️ `sendLater()` est rangé dans `queued`, **pas** dans `sent` — même famille de
   * piège que `mails` vs `messages` : chercher au mauvais endroit rend une liste
   * vide sans lever d'erreur, donc un test d'absence passerait à tort.
   */
  function queuedResets() {
    return fake.mails.queued(
      (queued): queued is PasswordResetNotification => queued instanceof PasswordResetNotification
    )
  }

  /**
   * Le jeton en clair n'existe **que** dans le mail : la base n'en garde qu'une
   * empreinte. Le test emprunte donc le chemin de l'utilisateur.
   */
  function tokenFromMail(): string {
    const text = String(queuedResets()[0].message.toJSON().message.text)
    const found = /token=([^\s&]+)/.exec(text)
    if (found === null) throw new Error('le mail ne porte pas de jeton')
    return decodeURIComponent(found[1])
  }

  const emailOf = async (make: () => Promise<User>): Promise<string> => {
    const user = await make()
    return user.email
  }

  const fixtures: ReadonlyArray<[label: string, make: () => Promise<string>, eligible: boolean]> = [
    ['membre avec mot de passe', () => emailOf(memberWithPassword), true],
    ['membre SSO sans mot de passe', () => emailOf(memberWithoutPassword), false],
    ['compte client non-membre', () => emailOf(clientAccount), false],
    ['adresse inconnue', async () => 'personne-ici@example.test', false],
  ]

  /**
   * La garantie anti-énumération du flux entier. Un `404`, un message « compte
   * introuvable », ou même un corps différent, dirait à qui tâtonne quelles
   * adresses existent — et `User.verifyPasswordCredentials` a été écrit pour ne
   * laisser aucun oracle de ce genre sur le chemin voisin.
   */
  test('répond identiquement quel que soit le compte', async ({ client, assert }) => {
    for (const [label, make] of fixtures) {
      const email = await make()

      const response = await client.post('/v1/auth/password/forgot').json({ email })

      assert.equal(response.status(), 204, label)
      assert.deepEqual(response.body(), {}, label)
    }
  })

  /**
   * L'autre moitié, et elle échoue pour une raison différente : minter un mot de
   * passe à un compte SSO créerait un second chemin d'authentification, et un
   * non-membre n'a rien à faire sur le dashboard.
   */
  test('n’envoie un lien qu’à un membre ayant déjà un mot de passe', async ({ client, assert }) => {
    for (const [label, make, eligible] of fixtures) {
      fake.mails.clear()
      const email = await make()

      await client.post('/v1/auth/password/forgot').json({ email })

      assert.lengthOf(queuedResets(), eligible ? 1 : 0, label)
    }
  })

  test('un lien ne sert qu’une fois', async ({ client, assert }) => {
    const user = await memberWithPassword()
    await client.post('/v1/auth/password/forgot').json({ email: user.email })
    const token = tokenFromMail()

    const first = await client
      .post('/v1/auth/password/reset')
      .json({ token, password: NEXT, passwordConfirmation: NEXT })
    first.assertStatus(204)

    const second = await client
      .post('/v1/auth/password/reset')
      .json({ token, password: NEXT, passwordConfirmation: NEXT })

    assert.equal(second.status(), 400)
    assert.equal(errorCodeOf(second), 'E_INVALID_RESET_TOKEN')
  })

  test('un lien expiré est refusé', async ({ client, assert }) => {
    const user = await memberWithPassword()
    await client.post('/v1/auth/password/forgot').json({ email: user.email })
    const token = tokenFromMail()

    await PasswordResetToken.query()
      .where('userId', user.id)
      .update({ expiresAt: DateTime.now().minus({ minutes: 1 }).toSQL() })

    const response = await client
      .post('/v1/auth/password/reset')
      .json({ token, password: NEXT, passwordConfirmation: NEXT })

    assert.equal(response.status(), 400)
    assert.equal(errorCodeOf(response), 'E_INVALID_RESET_TOKEN')
  })

  /**
   * Une réinitialisation est le remède à une compromission : laisser vivre la
   * session du voleur annulerait le geste entier.
   */
  test('révoque toutes les sessions', async ({ client, assert }) => {
    const user = await memberWithPassword()
    await User.accessTokens.create(user)
    await User.accessTokens.create(user)

    await client.post('/v1/auth/password/forgot').json({ email: user.email })
    const token = tokenFromMail()

    const response = await client
      .post('/v1/auth/password/reset')
      .json({ token, password: NEXT, passwordConfirmation: NEXT })
    response.assertStatus(204)

    assert.lengthOf(await User.accessTokens.all(user), 0)
  })

  /**
   * ⚠️ Le test le plus précieux du fichier, et le seul qui arrête un refactor
   * « table rase » bien intentionné : une réinitialisation qui efface le second
   * facteur transforme la compromission d'une boîte mail en prise de contrôle
   * complète du compte — exactement ce que ce facteur existe pour empêcher.
   */
  test('ne désactive pas la double authentification', async ({ client, assert }) => {
    const user = await memberWithPassword()
    await db.table('user_two_factor').insert({
      user_id: user.id,
      secret: 'chiffre-factice',
      confirmed_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    })

    await client.post('/v1/auth/password/forgot').json({ email: user.email })
    const token = tokenFromMail()

    const response = await client
      .post('/v1/auth/password/reset')
      .json({ token, password: NEXT, passwordConfirmation: NEXT })
    response.assertStatus(204)

    const row = await db.from('user_two_factor').where('user_id', user.id).first()
    assert.isNotNull(row, 'la 2FA doit survivre à une réinitialisation')
    assert.isNotNull(row.confirmed_at, 'la 2FA doit rester confirmée, donc active')
  })

  /**
   * Sans cela, chaque clic sur « Envoyer le lien » laisserait un lien de plus en
   * circulation, tous valables trente minutes.
   */
  test('une nouvelle demande périme la précédente', async ({ client, assert }) => {
    const user = await memberWithPassword()

    await client.post('/v1/auth/password/forgot').json({ email: user.email })
    const first = tokenFromMail()

    fake.mails.clear()
    await client.post('/v1/auth/password/forgot').json({ email: user.email })
    const second = tokenFromMail()

    const stale = await client
      .post('/v1/auth/password/reset')
      .json({ token: first, password: NEXT, passwordConfirmation: NEXT })
    assert.equal(stale.status(), 400, 'le premier lien doit être mort')

    const fresh = await client
      .post('/v1/auth/password/reset')
      .json({ token: second, password: NEXT, passwordConfirmation: NEXT })
    assert.equal(fresh.status(), 204, 'le dernier lien doit fonctionner')
  })

  test('ne stocke pas le jeton en clair', async ({ client, assert }) => {
    const user = await memberWithPassword()
    await client.post('/v1/auth/password/forgot').json({ email: user.email })
    const token = tokenFromMail()

    const rows = await db.from('password_reset_tokens').where('user_id', user.id)

    assert.lengthOf(rows, 1)
    assert.notEqual(rows[0].token_digest, token, 'la base ne doit pas porter le jeton lui-même')
  })
})
