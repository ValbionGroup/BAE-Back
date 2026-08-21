import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { errorCodeOf } from '#tests/helpers/api_error'
import { clearLimits } from '#tests/helpers/limiter'

const PASSWORD = 'mot-de-passe-actuel'

const totp = new TOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() })

test.group('Double authentification — activation', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => clearLimits())

  async function member(password: string | null = PASSWORD): Promise<User> {
    const row = await MemberFactory.create()
    const user = await User.findOrFail(row.id)
    user.password = password
    await user.save()
    return user
  }

  async function startEnrolment(client: any, user: User): Promise<string> {
    const response = await client.post('/v1/account/2fa').loginAs(user)
    response.assertStatus(201)
    return response.body().data.secret
  }

  const codeFor = (secret: string) => totp.generate({ secret })

  /**
   * Le secret ne doit jamais quitter la base après l'activation. Une régression du
   * `serializeAs: null`, ou un `serialize(row)` distrait, le mettrait dans le
   * profil de la personne — donc dans son navigateur.
   */
  test('le secret n’apparaît pas dans le profil', async ({ client, assert }) => {
    const user = await member()
    const secret = await startEnrolment(client, user)
    await client
      .post('/v1/account/2fa/confirm')
      .loginAs(user)
      .json({ code: await codeFor(secret) })

    const profile = await client.get('/v1/account/profile').loginAs(user)

    const body = JSON.stringify(profile.body())
    assert.notInclude(body, secret, 'le secret ne doit pas sortir')
    assert.notInclude(body, 'secret', 'aucune clé « secret » ne doit apparaître')
    assert.isTrue(profile.body().data.user.two_factor_enabled)
  })

  /**
   * Une inscription commencée puis abandonnée laisse un secret que personne n'a
   * vérifié. La traiter comme active enfermerait dehors quelqu'un qui n'a rien
   * configuré.
   */
  test('une inscription non confirmée ne bloque pas la connexion', async ({ client }) => {
    const user = await member()
    await startEnrolment(client, user)

    const login = await client
      .post('/v1/auth/login')
      .json({ email: user.email, password: PASSWORD })

    login.assertStatus(200)
  })

  test('un code faux ne confirme pas', async ({ client, assert }) => {
    const user = await member()
    await startEnrolment(client, user)

    const response = await client
      .post('/v1/account/2fa/confirm')
      .loginAs(user)
      .json({ code: '000000' })

    assert.equal(response.status(), 400)
    assert.equal(errorCodeOf(response), 'E_INVALID_TWO_FACTOR_CODE')

    const row = await db.from('user_two_factor').where('user_id', user.id).first()
    assert.isNull(row.confirmed_at, 'la configuration doit rester inerte')
  })

  test('confirmer rend dix codes, et une seconde fois est refusée', async ({ client, assert }) => {
    const user = await member()
    const secret = await startEnrolment(client, user)

    const first = await client
      .post('/v1/account/2fa/confirm')
      .loginAs(user)
      .json({ code: await codeFor(secret) })

    first.assertStatus(200)
    assert.lengthOf(first.body().data.recovery_codes, 10)

    const second = await client
      .post('/v1/account/2fa/confirm')
      .loginAs(user)
      .json({ code: await codeFor(secret) })

    assert.equal(second.status(), 409)
  })

  test('les codes de secours ne sont pas stockés en clair', async ({ client, assert }) => {
    const user = await member()
    const secret = await startEnrolment(client, user)
    const confirm = await client
      .post('/v1/account/2fa/confirm')
      .loginAs(user)
      .json({ code: await codeFor(secret) })

    const issued: string[] = confirm.body().data.recovery_codes
    const rows = await db.from('two_factor_recovery_codes').where('user_id', user.id)

    const digests = rows.map((row) => row.code_digest)
    for (const code of issued) {
      assert.notInclude(digests, code, 'aucune empreinte ne doit être le code lui-même')
    }
  })

  test('régénérer invalide le lot précédent', async ({ client, assert }) => {
    const user = await member()
    const secret = await startEnrolment(client, user)
    const confirm = await client
      .post('/v1/account/2fa/confirm')
      .loginAs(user)
      .json({ code: await codeFor(secret) })
    const old: string[] = confirm.body().data.recovery_codes

    const again = await client.post('/v1/account/2fa/recovery-codes').loginAs(user)
    again.assertStatus(200)

    const rows = await db.from('two_factor_recovery_codes').where('user_id', user.id)
    assert.lengthOf(rows, 10, 'dix codes vivants, pas vingt')

    // L'ancien lot ne doit plus ouvrir la porte.
    const login = await client
      .post('/v1/auth/login')
      .json({ email: user.email, password: PASSWORD })
    login.assertStatus(401)

    const verify = await client.post('/v1/auth/2fa/verify').json({ recoveryCode: old[0] })
    assert.notEqual(verify.status(), 200, 'un code du lot périmé ne doit pas connecter')
  })

  test('désactiver exige le mot de passe', async ({ client, assert }) => {
    const user = await member()
    const secret = await startEnrolment(client, user)
    await client
      .post('/v1/account/2fa/confirm')
      .loginAs(user)
      .json({ code: await codeFor(secret) })

    const refused = await client
      .post('/v1/account/2fa/disable')
      .loginAs(user)
      .json({ password: 'pas-le-bon' })
    assert.equal(refused.status(), 401)

    const accepted = await client
      .post('/v1/account/2fa/disable')
      .loginAs(user)
      .json({ password: PASSWORD })
    accepted.assertStatus(204)

    const row = await db.from('user_two_factor').where('user_id', user.id).first()
    assert.isNotOk(row, 'la configuration doit avoir disparu')
  })

  /**
   * La 2FA ne garde que la connexion par mot de passe : l'activer sur un compte
   * qui n'en a pas serait du poids mort, et laisserait croire à une protection.
   */
  test('refuse l’activation sur un compte sans mot de passe', async ({ client, assert }) => {
    const user = await member(null)

    const response = await client.post('/v1/account/2fa').loginAs(user)

    assert.equal(response.status(), 400)
    assert.equal(errorCodeOf(response), 'E_NO_PASSWORD_SET')
  })
})
