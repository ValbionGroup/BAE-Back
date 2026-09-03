import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Log from '#models/log'
import { UserFactory } from '#database/factories/user_factory'
import {
  REDACTED,
  isSecretKey,
  isSecretUrl,
  redactResponseBody,
  redactSecrets,
  redactUrl,
} from '#services/log_redaction_service'

test.group('Log redaction (unit)', () => {
  test('masks secret-looking keys at any depth', ({ assert }) => {
    const redacted = redactSecrets({
      id: 1,
      token: 'oat_MzM.secret',
      nested: { password: 'hunter2', keep: 'visible' },
      list: [{ apiKey: 'k' }, { fine: 'yes' }],
    }) as Record<string, any>

    assert.equal(redacted.id, 1)
    assert.equal(redacted.token, REDACTED)
    assert.equal(redacted.nested.password, REDACTED)
    assert.equal(redacted.nested.keep, 'visible')
    assert.equal(redacted.list[0].apiKey, REDACTED)
    assert.equal(redacted.list[1].fine, 'yes')
  })

  test('leaves primitives and nulls untouched', ({ assert }) => {
    assert.equal(redactSecrets('plain'), 'plain')
    assert.equal(redactSecrets(42), 42)
    assert.isNull(redactSecrets(null))
  })

  test('does not mutate its input', ({ assert }) => {
    const original = { token: 'secret' }
    redactSecrets(original)
    assert.equal(original.token, 'secret')
  })

  test('drops the whole body on a secret url', ({ assert }) => {
    assert.isUndefined(redactResponseBody('/v1/auth/login', { token: 'oat_MzM.secret' }))
  })

  test('redacts, but keeps, the body of an ordinary url', ({ assert }) => {
    const redacted = redactResponseBody('/v1/events', {
      id: 1,
      name: 'Soirée',
      nested: { password: 'hunter2' },
    }) as Record<string, any>

    assert.equal(redacted.id, 1)
    assert.equal(redacted.name, 'Soirée')
    assert.equal(redacted.nested.password, REDACTED)
  })

  test('recognises secret keys and auth urls', ({ assert }) => {
    assert.isTrue(isSecretKey('accessToken'))
    assert.isTrue(isSecretKey('PASSWORD'))
    assert.isFalse(isSecretKey('name'))
    assert.isTrue(isSecretUrl('/v1/auth/login'))
    assert.isFalse(isSecretUrl('/v1/events'))
  })

  test('masks the SSO authorization code and state in a url', ({ assert }) => {
    const redacted = redactUrl('/v1/auth/keycloak/callback?code=4/0AY0e-g7&state=xyz&iss=kc')

    assert.notInclude(redacted, '4/0AY0e-g7')
    assert.notInclude(redacted, 'xyz')
    assert.include(redacted, '/v1/auth/keycloak/callback')
    assert.include(redacted, `code=${encodeURIComponent(REDACTED)}`)
    assert.include(redacted, `state=${encodeURIComponent(REDACTED)}`)
    assert.include(redacted, 'iss=kc')
  })

  // `barcode` contains `code`: the query-string denylist matches whole parameter
  // names, so a substring match here would blind the stocks logs for nothing.
  test('keeps ordinary query parameters readable', ({ assert }) => {
    assert.equal(redactUrl('/v1/goods?barcode=3760091721234'), '/v1/goods?barcode=3760091721234')
    assert.equal(redactUrl('/v1/stocks?showEmpty=true'), '/v1/stocks?showEmpty=true')
    assert.equal(redactUrl('/v1/events'), '/v1/events')
  })

  test('masks any secret-looking parameter name', ({ assert }) => {
    const redacted = redactUrl('/v1/whatever?accessToken=oat_MzM.secret&name=léa')

    assert.notInclude(redacted, 'oat_MzM.secret')
    assert.include(redacted, 'name=l%C3%A9a')
  })

  test('treats the SSO callback as a secret url', ({ assert }) => {
    assert.isTrue(isSecretUrl('/v1/auth/keycloak/callback'))
  })
})

test.group('Log redaction (end to end)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('never stores the access token returned by login', async ({ client, assert }) => {
    const previous = await Log.query().orderBy('id', 'desc').first()
    const sinceId = previous?.id ?? 0

    const password = 'AStrongEnoughPassword1'
    await UserFactory.merge({ email: 'redaction@example.test', password }).create()

    const response = await client
      .post('/v1/auth/login')
      .json({ email: 'redaction@example.test', password })
    response.assertStatus(200)
    const token = response.body().data as string

    const logs = await Log.query().where('id', '>', sinceId).where('url', 'like', '%/auth/login%')
    assert.isNotEmpty(logs)

    for (const log of logs) {
      const serialised = JSON.stringify(log.meta ?? {})
      assert.notInclude(serialised, token)
      assert.notInclude(serialised, password)
      assert.notProperty(log.meta ?? {}, 'response')
    }
  })

  test('still records status and duration for auth routes', async ({ client, assert }) => {
    await client.post('/v1/auth/login').json({ email: 'nobody@example.test', password: 'wrong' })

    const log = await Log.query()
      .where('url', 'like', '%/auth/login%')
      .orderBy('id', 'desc')
      .first()
    assert.isNotNull(log)
    assert.property(log!.meta ?? {}, 'status')
    assert.property(log!.meta ?? {}, 'durationMs')
  })

  // Not against the SSO callback itself, which would need a reachable IdP: the
  // redaction is route-agnostic on purpose, so poisoning any route proves it —
  // and proves it for the routes nobody thought of.
  test('never stores an authorization code, in url or in message', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const code = 'sso-authorization-code-4f2b'
    await client.get('/v1/events').qs({ code, state: 'sso-state-9ac1' }).loginAs(user)

    const log = await Log.query().where('url', 'like', '%/v1/events%').orderBy('id', 'desc').first()
    assert.isNotNull(log)
    assert.notInclude(log!.url ?? '', code)
    assert.notInclude(log!.message ?? '', code)
    assert.notInclude(JSON.stringify(log!.meta ?? {}), code)
    // The parameter was seen and masked, not silently dropped.
    assert.include(log!.url ?? '', 'code=')
    assert.include(log!.url ?? '', encodeURIComponent(REDACTED))
  })

  /**
   * Le corps de réponse n'est plus journalisé par défaut : il faisait de `logs`
   * la table la plus grasse de la base, une grosse ligne par requête. Il se
   * rallume par `LOG_RESPONSE_BODY` le temps d'une investigation — et c'est
   * alors `redactResponseBody`, couvert unitairement plus haut, qui le nettoie.
   */
  test('omits response bodies unless LOG_RESPONSE_BODY asks for them', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    await client.get('/v1/events').loginAs(user)

    const log = await Log.query().where('url', 'like', '%/v1/events%').orderBy('id', 'desc').first()
    assert.isNotNull(log)
    assert.notProperty(log!.meta ?? {}, 'response')
    // Ce qui rend le journal utile survit : on sait toujours quoi, quand, et
    // combien de temps.
    assert.property(log!.meta ?? {}, 'status')
    assert.property(log!.meta ?? {}, 'durationMs')
  })
})
