import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'

test.group('Auth guard on /v1', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('rejects an unauthenticated request', async ({ client }) => {
    const response = await client.get('/v1/events')
    response.assertStatus(401)
  })

  test('allows an authenticated request', async ({ client }) => {
    const user = await UserFactory.create()
    const response = await client.get('/v1/events').loginAs(user)
    response.assertStatus(200)
  })
})
