import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'

test.group('Self signup', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates an account and returns a usable token', async ({ client, assert }) => {
    const password = 'aStrongEnoughPassword'

    const response = await client.post('/v1/auth/signup').json({
      email: 'newcomer@example.test',
      password,
      passwordConfirmation: password,
    })

    response.assertStatus(200)
    const { token } = response.body().data as { token: string }
    assert.isString(token)

    const user = await User.findByOrFail('email', 'newcomer@example.test')
    assert.isNull(user.casId)

    const profile = await client.get('/v1/account/profile').bearerToken(token)
    profile.assertStatus(200)
  })

  test('rejects a duplicate email', async ({ client }) => {
    const password = 'aStrongEnoughPassword'
    const payload = {
      email: 'duplicate@example.test',
      password,
      passwordConfirmation: password,
    }

    await client.post('/v1/auth/signup').json(payload)
    const second = await client.post('/v1/auth/signup').json(payload)

    second.assertStatus(422)
  })

  test('rejects a mismatched password confirmation', async ({ client }) => {
    const response = await client.post('/v1/auth/signup').json({
      email: 'mismatch@example.test',
      password: 'aStrongEnoughPassword',
      passwordConfirmation: 'aDifferentPassword',
    })

    response.assertStatus(422)
  })
})
