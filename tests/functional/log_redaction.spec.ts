import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Log from '#models/log'
import { UserFactory } from '#database/factories/user_factory'
import { REDACTED, isSecretKey, isSecretUrl, redactSecrets } from '#services/log_redaction_service'

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

  test('recognises secret keys and auth urls', ({ assert }) => {
    assert.isTrue(isSecretKey('accessToken'))
    assert.isTrue(isSecretKey('PASSWORD'))
    assert.isFalse(isSecretKey('name'))
    assert.isTrue(isSecretUrl('/v1/auth/login'))
    assert.isFalse(isSecretUrl('/v1/events'))
  })
})

test.group('Log redaction (end to end)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /**
   * The request logger stored `ctx.response.getBody()` verbatim, so every token
   * minted by `/auth/login` and `/auth/signup` landed in the `logs` table in
   * clear text — readable by any authenticated user through `GET /v1/logs`.
   */
  test('never stores the access token returned by signup', async ({ client, assert }) => {
    // Rows written before this fix still carry response bodies, so only look at
    // what THIS request produces.
    const previous = await Log.query().orderBy('id', 'desc').first()
    const sinceId = previous?.id ?? 0

    const password = 'aStrongEnoughPassword'
    const response = await client.post('/v1/auth/signup').json({
      email: 'redaction@example.test',
      password,
      passwordConfirmation: password,
    })
    response.assertStatus(200)
    const { token } = response.body().data as { token: string }

    const logs = await Log.query().where('id', '>', sinceId).where('url', 'like', '%/auth/signup%')
    assert.isNotEmpty(logs)

    for (const log of logs) {
      const serialised = JSON.stringify(log.meta ?? {})
      assert.notInclude(serialised, token)
      assert.notInclude(serialised, password)
      // The body is dropped wholesale for auth routes.
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

  test('keeps ordinary response bodies for non-auth routes', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await client.get('/v1/events').loginAs(user)

    const log = await Log.query().where('url', 'like', '%/v1/events%').orderBy('id', 'desc').first()
    assert.isNotNull(log)
    assert.property(log!.meta ?? {}, 'response')
  })
})
