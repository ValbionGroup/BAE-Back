import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'
import User from '#models/user'
import JwtService from '#services/jwt_service'
import { MemberFactory } from '#database/factories/members_factory'
import { SESSION_COOKIE, TWO_FACTOR_COOKIE } from '#services/session_cookie'
import { errorCodeOf } from '#tests/helpers/api_error'
import { clearLimits } from '#tests/helpers/limiter'

const PASSWORD = 'mot-de-passe-actuel'

const totp = new TOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() })

test.group('Double authentification — connexion', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => clearLimits())

  async function memberWithPassword(): Promise<User> {
    const row = await MemberFactory.create()
    const user = await User.findOrFail(row.id)
    user.password = PASSWORD
    await user.save()
    return user
  }

  /** Active réellement la 2FA, en passant par les endpoints. */
  async function enrol(client: any, user: User): Promise<string> {
    const start = await client.post('/v1/account/2fa').loginAs(user)
    const secret: string = start.body().data.secret
    await client
      .post('/v1/account/2fa/confirm')
      .loginAs(user)
      .json({ code: await totp.generate({ secret }) })
    return secret
  }

  const login = (client: any, user: User) =>
    client.post('/v1/auth/login').json({ email: user.email, password: PASSWORD })

  /**
   * Le code du pas SUIVANT, et non du pas courant.
   *
   * L'activation vient de consommer le pas en cours en le posant dans
   * `last_used_counter` : redemander le meme code serait un rejeu, que le serveur
   * refuse a juste titre. Un decalage de trente secondes tombe toujours pile un
   * pas plus loin, donc dans la tolerance de derive — et c'est aussi ce que fait
   * un vrai utilisateur, qui ne se connecte pas dans la seconde qui suit.
   */
  const nextCode = (secret: string) =>
    totp.generate({ secret, epoch: Math.floor(Date.now() / 1000) + 30 })

  /**
   * ⚠️ Si cette assertion tombe, la 2FA est décorative : le mot de passe seul
   * ouvrirait la session malgré un second facteur configuré.
   */
  test('le mot de passe seul n’ouvre aucune session', async ({ client, assert }) => {
    const user = await memberWithPassword()
    await enrol(client, user)

    const response = await login(client, user)

    assert.equal(response.status(), 401)
    assert.equal(errorCodeOf(response), 'E_TWO_FACTOR_REQUIRED')
    assert.isUndefined(response.cookie(SESSION_COOKIE), 'aucune session ne doit être ouverte')

    const challenge = response.cookie(TWO_FACTOR_COOKIE)
    assert.isDefined(challenge, 'le défi doit être posé')
    assert.isTrue(challenge!.httpOnly, 'un défi lisible en JavaScript serait exfiltrable')
  })

  test('un code valide ouvre la session et consomme le défi', async ({ client, assert }) => {
    const user = await memberWithPassword()
    const secret = await enrol(client, user)
    const challengeResponse = await login(client, user)
    const challenge = challengeResponse.cookie(TWO_FACTOR_COOKIE)!.value

    const response = await client
      .post('/v1/auth/2fa/verify')
      .withCookie(TWO_FACTOR_COOKIE, challenge)
      .json({ code: await nextCode(secret) })

    response.assertStatus(200)
    assert.isDefined(response.cookie(SESSION_COOKIE), 'la session doit être ouverte')
  })

  /**
   * ⚠️ Le test le plus important du fichier. `QrsController.mine` distribue à tout
   * utilisateur authentifié un jeton `identity` signé de la **même clé**, et
   * affiché à l'écran sous forme de QR. Sans l'assertion sur `type`, sa photo
   * serait un défi valide — la 2FA se contournerait avec un appareil photo.
   */
  test('un jeton QR d’identité n’est pas un défi valide', async ({ client, assert }) => {
    const user = await memberWithPassword()
    const secret = await enrol(client, user)

    const identity = await new JwtService().generateQrToken(
      { type: 'identity', userId: user.id },
      180
    )

    const response = await client
      .post('/v1/auth/2fa/verify')
      .withCookie(TWO_FACTOR_COOKIE, identity)
      .json({ code: await nextCode(secret) })

    assert.equal(response.status(), 401, 'un jeton d’un autre type doit être refusé')
    assert.equal(errorCodeOf(response), 'E_TWO_FACTOR_CHALLENGE_INVALID')
    assert.isUndefined(response.cookie(SESSION_COOKIE))
  })

  /**
   * Un code lu par-dessus l'épaule resterait utilisable pendant sa fenêtre, que la
   * tolérance de dérive porte à une minute et demie.
   */
  test('un code TOTP ne se rejoue pas', async ({ client, assert }) => {
    const user = await memberWithPassword()
    const secret = await enrol(client, user)
    const code = await nextCode(secret)

    const firstResponse = await login(client, user)
    const first = firstResponse.cookie(TWO_FACTOR_COOKIE)!.value
    const accepted = await client
      .post('/v1/auth/2fa/verify')
      .withCookie(TWO_FACTOR_COOKIE, first)
      .json({ code })
    accepted.assertStatus(200)

    const secondResponse = await login(client, user)
    const second = secondResponse.cookie(TWO_FACTOR_COOKIE)!.value
    const replayed = await client
      .post('/v1/auth/2fa/verify')
      .withCookie(TWO_FACTOR_COOKIE, second)
      .json({ code })

    assert.equal(replayed.status(), 401, 'le même code ne doit pas servir deux fois')
  })

  /**
   * Une faute de frappe ne doit pas forcer à ressaisir son mot de passe : c'est
   * ainsi qu'on finit par désactiver la 2FA.
   */
  test('le défi survit à un code faux', async ({ client, assert }) => {
    const user = await memberWithPassword()
    const secret = await enrol(client, user)
    const challengeResponse = await login(client, user)
    const challenge = challengeResponse.cookie(TWO_FACTOR_COOKIE)!.value

    const refused = await client
      .post('/v1/auth/2fa/verify')
      .withCookie(TWO_FACTOR_COOKIE, challenge)
      .json({ code: '000000' })
    assert.equal(refused.status(), 401)
    assert.equal(errorCodeOf(refused), 'E_INVALID_TWO_FACTOR_CODE')

    const retried = await client
      .post('/v1/auth/2fa/verify')
      .withCookie(TWO_FACTOR_COOKIE, challenge)
      .json({ code: await nextCode(secret) })

    assert.equal(retried.status(), 200, 'le même défi doit encore servir')
  })

  test('un code de secours ouvre la session, une seule fois', async ({ client, assert }) => {
    const user = await memberWithPassword()
    const start = await client.post('/v1/account/2fa').loginAs(user)
    const secret: string = start.body().data.secret
    const confirm = await client
      .post('/v1/account/2fa/confirm')
      .loginAs(user)
      .json({ code: await totp.generate({ secret }) })
    const codes: string[] = confirm.body().data.recovery_codes

    const firstResponse = await login(client, user)
    const first = firstResponse.cookie(TWO_FACTOR_COOKIE)!.value
    const accepted = await client
      .post('/v1/auth/2fa/verify')
      .withCookie(TWO_FACTOR_COOKIE, first)
      .json({ recoveryCode: codes[0] })

    accepted.assertStatus(200)
    assert.equal(accepted.body().data.recovery_codes_remaining, 9)

    const secondResponse = await login(client, user)
    const second = secondResponse.cookie(TWO_FACTOR_COOKIE)!.value
    const replayed = await client
      .post('/v1/auth/2fa/verify')
      .withCookie(TWO_FACTOR_COOKIE, second)
      .json({ recoveryCode: codes[0] })

    assert.equal(replayed.status(), 401, 'un code de secours ne sert qu’une fois')
  })

  /**
   * La garantie anti-énumération : `E_TWO_FACTOR_REQUIRED` n'est atteignable
   * qu'après une vérification d'identifiants réussie. Déplacer la consultation de
   * `user_two_factor` avant elle recréerait l'oracle que
   * `verifyPasswordCredentials` a été écrit pour tuer.
   */
  test('un refus d’identifiants est identique avec ou sans 2FA', async ({ client, assert }) => {
    const protege = await memberWithPassword()
    await enrol(client, protege)
    const nu = await memberWithPassword()

    const cases: ReadonlyArray<[label: string, email: string]> = [
      ['compte protégé par 2FA', protege.email],
      ['compte sans 2FA', nu.email],
      ['compte inexistant', 'personne-ici@example.test'],
    ]

    const seen: string[] = []
    for (const [label, email] of cases) {
      const response = await client.post('/v1/auth/login').json({ email, password: 'pas-le-bon' })

      assert.equal(response.status(), 401, label)
      assert.equal(errorCodeOf(response), 'E_INVALID_CREDENTIALS', label)
      seen.push(JSON.stringify(response.body()))
    }

    assert.equal(new Set(seen).size, 1, 'les trois corps doivent être identiques')
  })

  test('un budget de tentatives épuisé tue le défi', async ({ client, assert }) => {
    const user = await memberWithPassword()
    await enrol(client, user)
    const challengeResponse = await login(client, user)
    const challenge = challengeResponse.cookie(TWO_FACTOR_COOKIE)!.value

    let last
    for (let attempt = 0; attempt < 7; attempt += 1) {
      last = await client
        .post('/v1/auth/2fa/verify')
        .withCookie(TWO_FACTOR_COOKIE, challenge)
        .json({ code: '000000' })
    }

    assert.equal(last!.status(), 429, 'les tentatives doivent finir par être refusées')
    assert.equal(errorCodeOf(last!), 'E_TOO_MANY_REQUESTS')

    const cleared = last!.cookie(TWO_FACTOR_COOKIE)
    assert.isTrue(
      cleared === undefined || cleared.value === '',
      'le défi doit être effacé, sinon il suffit d’attendre la fenêtre'
    )
  })

  test('la connexion sans 2FA efface un défi resté en place', async ({ client, assert }) => {
    const user = await memberWithPassword()

    const response = await client
      .post('/v1/auth/login')
      .withCookie(TWO_FACTOR_COOKIE, 'jeton-perime')
      .json({ email: user.email, password: PASSWORD })

    response.assertStatus(200)
    const cleared = response.cookie(TWO_FACTOR_COOKIE)
    assert.isTrue(cleared === undefined || cleared.value === '')

    const rows = await db.from('user_two_factor').where('user_id', user.id)
    assert.lengthOf(rows, 0)
  })
})
