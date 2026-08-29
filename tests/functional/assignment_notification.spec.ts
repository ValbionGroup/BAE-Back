import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import ActivityEvent from '#models/activity_event'
import Notification from '#models/notification'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'
import {
  COORDINATION_PERMISSIONS,
  asCoordinator,
  grantPermissions,
} from '#tests/helpers/permissions'
import { ASSIGNMENTS_PUBLISHED } from '#services/assignment_notification_service'

async function traces(eventId: number) {
  return ActivityEvent.query()
    .where('subjectType', 'event')
    .where('subjectId', eventId)
    .where('verb', ASSIGNMENTS_PUBLISHED)
}

test.group('Notification des affectations', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('prévient chaque membre affecté et trace le fait', async ({ client, assert }) => {
    const coordinator = await MemberFactory.create()
    const user = await asCoordinator(coordinator)
    const event = await EventFactory.merge({ status: 'scheduled' }).create()
    const job = await JobFactory.create()
    const first = await MemberFactory.create()
    const second = await MemberFactory.create()
    for (const member of [first, second]) {
      await MemberEventAssignedJob.create({
        memberId: member.id,
        eventId: event.id,
        jobId: job.id,
        locked: false,
        pointsDelta: 0,
      })
    }

    const response = await client.post(`/v1/events/${event.id}/assignments/notify`).loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({ data: { notified: 2, recipients: 2 } })

    const [trace] = await traces(event.id)
    assert.isDefined(trace)

    // `members.id` **est** l'id du user : la table partage sa clé primaire avec
    // `users`, donc un memberId affecté est directement un destinataire.
    const notifications = await Notification.query().where('eventId', trace.id)
    const notified = new Set(notifications.map((row) => row.userId))
    assert.deepEqual([...notified].sort(), [first.id, second.id].sort())
  })

  /**
   * Le piège que la clé d'idempotence évite : `presence_reminder` déduplique sur
   * « ce verbe, cette soirée », ce qui ici rendrait toute revalidation muette.
   * La clé porte donc l'**empreinte de l'affectation**, pas la soirée.
   */
  test('revalider sans changement ne prévient personne une seconde fois', async ({
    client,
    assert,
  }) => {
    const user = await asCoordinator(await MemberFactory.create())
    const event = await EventFactory.merge({ status: 'scheduled' }).create()
    const job = await JobFactory.create()
    const member = await MemberFactory.create()
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 0,
    })

    await client.post(`/v1/events/${event.id}/assignments/notify`).loginAs(user)
    const again = await client.post(`/v1/events/${event.id}/assignments/notify`).loginAs(user)

    again.assertStatus(200)
    again.assertBodyContains({ data: { notified: 0 } })
    assert.lengthOf(await traces(event.id), 1)
  })

  test('revalider après un changement d’affectation prévient de nouveau', async ({
    client,
    assert,
  }) => {
    const user = await asCoordinator(await MemberFactory.create())
    const event = await EventFactory.merge({ status: 'scheduled' }).create()
    const job = await JobFactory.create()
    const first = await MemberFactory.create()
    await MemberEventAssignedJob.create({
      memberId: first.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 0,
    })

    await client.post(`/v1/events/${event.id}/assignments/notify`).loginAs(user)

    const late = await MemberFactory.create()
    await MemberEventAssignedJob.create({
      memberId: late.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 0,
    })

    const again = await client.post(`/v1/events/${event.id}/assignments/notify`).loginAs(user)

    again.assertStatus(200)
    again.assertBodyContains({ data: { notified: 2 } })
    assert.lengthOf(await traces(event.id), 2)
  })

  test('ne prévient personne et ne trace rien sur une soirée sans affectation', async ({
    client,
    assert,
  }) => {
    const user = await asCoordinator(await MemberFactory.create())
    const event = await EventFactory.merge({ status: 'scheduled' }).create()

    const response = await client.post(`/v1/events/${event.id}/assignments/notify`).loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({ data: { notified: 0, recipients: 0 } })
    assert.lengthOf(await traces(event.id), 0)
  })

  /**
   * Le template désactive le bouton sur une soirée clôturée, ce qui ne couvre
   * que la souris. La garde vit ici, comme celle de `open`.
   */
  test('refuse de prévenir sur une soirée clôturée', async ({ client, assert }) => {
    const user = await asCoordinator(await MemberFactory.create())
    const event = await EventFactory.merge({ status: 'completed' }).create()
    const job = await JobFactory.create()
    const member = await MemberFactory.create()
    await MemberEventAssignedJob.create({
      memberId: member.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 0,
    })

    const response = await client.post(`/v1/events/${event.id}/assignments/notify`).loginAs(user)

    response.assertStatus(409)
    response.assertBodyContains({ error: { code: 'E_EVENT_CLOSED' } })
    assert.lengthOf(await traces(event.id), 0)
  })

  test('refuse de prévenir sans assignment:write', async ({ client }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(
      member,
      COORDINATION_PERMISSIONS.filter((permission) => permission !== 'assignment:write')
    )
    const event = await EventFactory.merge({ status: 'scheduled' }).create()

    const response = await client.post(`/v1/events/${event.id}/assignments/notify`).loginAs(user)

    response.assertStatus(403)
  })
})
