import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Notification from '#models/notification'
import { emit } from '#services/notification_service'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

test.group('Notifications — API personnelle', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function notifyInApp(userId: number, subjectId: number) {
    return emit({
      verb: 'presence.pending',
      subjectType: 'event',
      subjectId,
      payload: { subject: 'Réponds', lines: ['Merci de répondre.'] },
      recipients: [userId],
      channels: ['in_app'],
    })
  }

  test('ne rend que les notifications de l’appelant', async ({ client, assert }) => {
    const mine = await MemberFactory.create()
    const other = await MemberFactory.create()
    const user = await grantPermissions(mine, [])

    await notifyInApp(mine.id, 501)
    await notifyInApp(other.id, 502)

    const response = await client.get('/v1/account/notifications').loginAs(user)
    response.assertStatus(200)

    const rows = (response.body() as { data: { subject_id: number }[] }).data
    const subjects = rows.map((row) => row.subject_id)

    assert.include(subjects, 501)
    assert.notInclude(subjects, 502, 'les notifications d’autrui ne doivent jamais fuiter')
  })

  test('marque une notification comme lue', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])
    const result = await notifyInApp(member.id, 503)
    const row = await Notification.query().where('eventId', result.eventId).firstOrFail()

    const response = await client.patch(`/v1/account/notifications/${row.id}/read`).loginAs(user)
    response.assertStatus(200)

    const reloaded = await Notification.findOrFail(row.id)
    assert.isNotNull(reloaded.readAt)
  })

  test('relire ne réécrit pas la date — sinon « lue il y a 2 jours » repart à zéro', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])
    const result = await notifyInApp(member.id, 504)
    const row = await Notification.query().where('eventId', result.eventId).firstOrFail()

    await client.patch(`/v1/account/notifications/${row.id}/read`).loginAs(user)
    const afterFirst = await Notification.findOrFail(row.id)
    const first = afterFirst.readAt

    await client.patch(`/v1/account/notifications/${row.id}/read`).loginAs(user)
    const afterSecond = await Notification.findOrFail(row.id)
    const second = afterSecond.readAt

    assert.equal(first?.toISO(), second?.toISO())
  })

  test('ne laisse pas marquer lue la notification d’un autre', async ({ client }) => {
    const mine = await MemberFactory.create()
    const other = await MemberFactory.create()
    const user = await grantPermissions(mine, [])

    const result = await notifyInApp(other.id, 505)
    const row = await Notification.query().where('eventId', result.eventId).firstOrFail()

    const response = await client.patch(`/v1/account/notifications/${row.id}/read`).loginAs(user)

    // 404 et non 403 : distinguer les deux dirait à l'appelant que cette
    // notification existe.
    response.assertStatus(404)
  })
})
