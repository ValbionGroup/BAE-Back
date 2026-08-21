import { test } from '@japa/runner'
import { DateTime } from 'luxon'
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

  /**
   * `emit()` retombe sur `['mail']` quand l'appelant ne dit rien — c'est le cas
   * de tous les rappels de présence, qui n'ont donc aucun jumeau in-app. Restreindre
   * la liste au canal `in_app` les ferait disparaître de l'écran sans écarter
   * pour autant un seul double affichage : il n'y a rien à confondre.
   */
  test('rend un fait livré par mail seul', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    await emit({
      verb: 'presence.pending',
      subjectType: 'event',
      subjectId: 506,
      payload: { subject: 'Réponds', lines: ['Merci de répondre.'] },
      recipients: [member.id],
    })

    const response = await client.get('/v1/account/notifications').loginAs(user)
    response.assertStatus(200)

    const rows = (response.body() as { data: { subject_id: number }[] }).data
    assert.include(
      rows.map((row) => row.subject_id),
      506
    )
  })

  /**
   * Le même fait livré des deux façons est **un** fait : deux lignes à l'écran
   * feraient croire à un double envoi. Et `sent_at` doit remonter, parce que
   * `MAIL_MAILER=log` avale les messages sans rien signaler — c'est la seule
   * chose qui distingue un rappel parti d'un rappel resté en file.
   */
  test('regroupe les deux canaux d’un même fait en une entrée, avec l’état d’envoi', async ({
    client,
    assert,
  }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    const result = await emit({
      verb: 'ticket.opened',
      subjectType: 'ticket',
      subjectId: 507,
      payload: { subject: 'Panne de tireuse' },
      recipients: [member.id],
      channels: ['in_app', 'mail'],
    })

    const sentAt = DateTime.fromISO('2026-08-18T09:30:00.000Z')
    await Notification.query()
      .where('eventId', result.eventId)
      .where('channel', 'mail')
      .update({ sent_at: sentAt.toSQL() })

    const response = await client.get('/v1/account/notifications').loginAs(user)
    response.assertStatus(200)

    const rows = (
      response.body() as {
        data: { subject_id: number; channels: { channel: string; sent_at: string | null }[] }[]
      }
    ).data
    const matching = rows.filter((row) => row.subject_id === 507)

    assert.lengthOf(matching, 1, 'un fait, une entrée')
    assert.sameMembers(
      matching[0].channels.map((delivery) => delivery.channel),
      ['in_app', 'mail']
    )
    const mail = matching[0].channels.find((delivery) => delivery.channel === 'mail')
    assert.isNotNull(mail?.sent_at ?? null, 'l’état d’envoi du mail doit remonter')
  })

  /**
   * Puisque l'écran ne montre plus qu'une entrée par fait, un clic doit régler le
   * fait entier. Sans ça la ligne resterait non lue par sa livraison jumelle, et
   * le compteur « Non lues » ne retomberait jamais à zéro.
   */
  test('marquer lu règle toutes les livraisons du même fait', async ({ client, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, [])

    const result = await emit({
      verb: 'ticket.opened',
      subjectType: 'ticket',
      subjectId: 508,
      payload: { subject: 'Panne de tireuse' },
      recipients: [member.id],
      channels: ['in_app', 'mail'],
    })
    const inApp = await Notification.query()
      .where('eventId', result.eventId)
      .where('channel', 'in_app')
      .firstOrFail()

    const response = await client.patch(`/v1/account/notifications/${inApp.id}/read`).loginAs(user)
    response.assertStatus(200)

    const rows = await Notification.query().where('eventId', result.eventId)
    assert.lengthOf(rows, 2)
    for (const row of rows) {
      assert.isNotNull(row.readAt, `la livraison ${row.channel} doit être lue`)
    }
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
