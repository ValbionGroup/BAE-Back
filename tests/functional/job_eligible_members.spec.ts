import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { grantPermissions } from '#tests/helpers/permissions'
import { MemberFactory } from '#database/factories/members_factory'
import { JobFactory } from '#database/factories/job_factory'

function listsRow(body: unknown, jobId: number, memberId: number): boolean {
  const { data } = body as { data: Array<{ job_id: number; member_id: number }> }
  return data.some((r) => r.job_id === jobId && r.member_id === memberId)
}

test.group('Job eligible members', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('adds and lists an eligible member for a job', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['job:read', 'job:write', 'job:delete'])
    const job = await JobFactory.create()

    const created = await client
      .post('/v1/job-eligible-members')
      .loginAs(user)
      .json({ job_id: job.id, member_id: member.id })
    created.assertStatus(200)
    created.assertBodyContains({ data: { job_id: job.id, member_id: member.id } })

    const index = await client.get('/v1/job-eligible-members').loginAs(user)
    assert.isTrue(listsRow(index.body(), job.id, member.id))
  })

  test('removes an eligible member for a job', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['job:read', 'job:write', 'job:delete'])
    const job = await JobFactory.create()
    await client
      .post('/v1/job-eligible-members')
      .loginAs(user)
      .json({ job_id: job.id, member_id: member.id })

    const destroyed = await client
      .delete('/v1/job-eligible-members')
      .loginAs(user)
      .qs({ job_id: job.id, member_id: member.id })
    destroyed.assertStatus(204)

    const index = await client.get('/v1/job-eligible-members').loginAs(user)
    assert.isFalse(listsRow(index.body(), job.id, member.id))
  })
})
