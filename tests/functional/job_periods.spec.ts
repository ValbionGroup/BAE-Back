import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { grantPermissions } from '#tests/helpers/permissions'
import { MemberFactory } from '#database/factories/members_factory'
import { JobFactory } from '#database/factories/job_factory'
import { DEFAULT_JOB_PERIOD } from '#services/matching_service'

test.group('Job periods', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('GET /v1/jobs exposes the type of each job', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['job:read', 'job:write'])
    const job = await JobFactory.merge({ type: 'before' }).create()

    const index = await client.get('/v1/jobs').loginAs(user)
    const body = index.body() as { data: Array<{ id: number; type: string }> }
    const row = body.data.find((r) => r.id === job.id)
    assert.equal(row?.type, 'before')
  })

  test('POST /v1/jobs accepts an explicit type and persists it', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['job:read', 'job:write'])

    const created = await client
      .post('/v1/jobs')
      .loginAs(user)
      .json({ name: 'Installation des tables', type: 'before' })
    created.assertStatus(200)
    created.assertBodyContains({ data: { type: 'before' } })

    const show = await client
      .get(`/v1/jobs/${(created.body() as { data: { id: number } }).data.id}`)
      .loginAs(user)
    assert.equal((show.body() as { data: { type: string } }).data.type, 'before')
  })

  test('POST /v1/jobs without a type falls back to DEFAULT_JOB_PERIOD', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['job:read', 'job:write'])

    const created = await client.post('/v1/jobs').loginAs(user).json({ name: 'Service' })
    created.assertStatus(200)
    const body = created.body() as { data: { type: string } }
    assert.equal(body.data.type, DEFAULT_JOB_PERIOD)
  })

  test('PUT /v1/jobs/:id changes the type', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['job:read', 'job:write'])
    const job = await JobFactory.create()
    assert.equal(job.type, DEFAULT_JOB_PERIOD)

    const updated = await client
      .put(`/v1/jobs/${job.id}`)
      .loginAs(user)
      .json({ name: job.name, type: 'after' })
    updated.assertStatus(200)
    updated.assertBodyContains({ data: { type: 'after' } })
  })

  test('PUT /v1/jobs/:id without a type preserves the existing period', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['job:read', 'job:write'])
    const job = await JobFactory.merge({ type: 'before' }).create()

    const updated = await client
      .put(`/v1/jobs/${job.id}`)
      .loginAs(user)
      .json({ name: 'Installation des tables (renommée)' })
    updated.assertStatus(200)
    updated.assertBodyContains({ data: { type: 'before' } })

    const show = await client.get(`/v1/jobs/${job.id}`).loginAs(user)
    assert.equal((show.body() as { data: { type: string } }).data.type, 'before')
  })

  test('an unknown type is rejected with 422', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['job:read', 'job:write'])

    const created = await client
      .post('/v1/jobs')
      .loginAs(user)
      .json({ name: 'Poste fantôme', type: 'lunch' })
    created.assertStatus(422)
  })
})
