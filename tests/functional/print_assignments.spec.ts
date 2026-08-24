import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Event from '#models/event'
import Job from '#models/job'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { pdfService } from '#services/pdf_service'

test.group("Feuille d'affectation PDF", (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.teardown(() => pdfService.closeBrowser())

  test('serves a PDF grouped by period, with an empty slot not breaking generation', async ({
    client,
    assert,
  }) => {
    const event = await Event.create({
      name: 'Soirée Hivernale',
      description: null,
      date: DateTime.fromISO('2026-02-14'),
      status: 'scheduled',
      duration: 4 * 60 * 60,
    })
    const job = await Job.create({ name: 'Cuisine', type: 'during', description: null })
    await event.related('jobs').attach({ [job.id]: { count: 2 } })
    const member = await MemberFactory.with('user', 1, (u) =>
      u.merge({ firstName: 'Tom', lastName: 'Bernard' })
    ).create()
    await MemberEventAssignedJob.create({
      eventId: event.id,
      jobId: job.id,
      memberId: member.id,
      locked: true,
      pointsDelta: 0,
    })

    const user = await grantPermissions(member, ['job:read'])

    const response = await client.get(`/v1/events/${event.id}/assignments/pdf`).loginAs(user)

    response.assertStatus(200)
    assert.isTrue(response.header('content-type')?.startsWith('application/pdf'))
    assert.equal(Buffer.from(response.body()).subarray(0, 4).toString('latin1'), '%PDF')
  }).timeout(20_000)

  test('refuses a member without job:read', async ({ client }) => {
    const event = await Event.create({
      name: 'Soirée',
      description: null,
      date: DateTime.fromISO('2026-02-14'),
      status: 'scheduled',
      duration: 4 * 60 * 60,
    })
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    const response = await client.get(`/v1/events/${event.id}/assignments/pdf`).loginAs(user)

    response.assertStatus(403)
  })
})
