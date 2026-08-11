import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { JobFactory } from '#database/factories/job_factory'

test.group('My job preferences', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function actor() {
    const member = await MemberFactory.create()
    return { member, user: await User.findOrFail(member.id) }
  }

  test('starts empty', async ({ client }) => {
    const { user } = await actor()

    const response = await client.get('/v1/account/preferences').loginAs(user)

    response.assertStatus(200)
    response.assertBody({ data: [] })
  })

  test('derives the rank from the order of the submitted list', async ({ client, assert }) => {
    const { user } = await actor()
    const first = await JobFactory.merge({ name: 'Barman' }).create()
    const second = await JobFactory.merge({ name: 'Caissier' }).create()

    const response = await client
      .put('/v1/account/preferences')
      .loginAs(user)
      .json({ jobIds: [second.id, first.id] })

    response.assertStatus(200)
    const body = response.body() as { data: Array<{ job_id: number; preference_rank: number }> }
    assert.deepEqual(
      body.data.map((row) => [row.job_id, row.preference_rank]),
      [
        [second.id, 1],
        [first.id, 2],
      ]
    )
  })

  test('replaces the previous ranking rather than adding to it', async ({ client, assert }) => {
    const { user } = await actor()
    const a = await JobFactory.create()
    const b = await JobFactory.create()

    await client
      .put('/v1/account/preferences')
      .loginAs(user)
      .json({ jobIds: [a.id, b.id] })
    await client
      .put('/v1/account/preferences')
      .loginAs(user)
      .json({ jobIds: [b.id] })

    const response = await client.get('/v1/account/preferences').loginAs(user)
    const body = response.body() as { data: Array<{ job_id: number; preference_rank: number }> }
    assert.deepEqual(
      body.data.map((row) => [row.job_id, row.preference_rank]),
      [[b.id, 1]]
    )
  })

  test('clears the ranking with an empty list', async ({ client }) => {
    const { user } = await actor()
    const job = await JobFactory.create()
    await client
      .put('/v1/account/preferences')
      .loginAs(user)
      .json({ jobIds: [job.id] })

    const response = await client.put('/v1/account/preferences').loginAs(user).json({ jobIds: [] })

    response.assertStatus(200)
    response.assertBody({ data: [] })
  })

  test('refuses a duplicated job, which would mean two ranks for one poste', async ({ client }) => {
    const { user } = await actor()
    const job = await JobFactory.create()

    const response = await client
      .put('/v1/account/preferences')
      .loginAs(user)
      .json({ jobIds: [job.id, job.id] })

    response.assertStatus(422)
  })

  test('refuses a job that does not exist', async ({ client, assert }) => {
    const { user, member } = await actor()
    const job = await JobFactory.create()

    const response = await client
      .put('/v1/account/preferences')
      .loginAs(user)
      .json({ jobIds: [job.id, job.id + 9999] })

    response.assertStatus(422)

    await member.load('preferences')
    assert.lengthOf(member.preferences, 0)
  })

  test('never exposes or edits somebody else’s ranking', async ({ client, assert }) => {
    const mine = await actor()
    const other = await actor()
    const job = await JobFactory.create()

    await client
      .put('/v1/account/preferences')
      .loginAs(other.user)
      .json({ jobIds: [job.id] })

    const response = await client.get('/v1/account/preferences').loginAs(mine.user)

    response.assertStatus(200)
    response.assertBody({ data: [] })
    await other.member.load('preferences')
    assert.lengthOf(other.member.preferences, 1)
  })

  test('requires authentication', async ({ client }) => {
    const response = await client.get('/v1/account/preferences')
    response.assertStatus(401)
  })
})
