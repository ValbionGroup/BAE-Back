import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import ace from '@adonisjs/core/services/ace'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import Notification from '#models/notification'
import { emit } from '#services/notification_service'
import { MemberFactory } from '#database/factories/members_factory'
import NotifyDispatch from '../../commands/notify_dispatch.js'

test.group('notify:dispatch', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('envoie les livraisons en attente et les horodate', async ({ assert }) => {
    const fake = mail.fake()
    const member = await MemberFactory.with('user', 1, (u) =>
      u.merge({ email: 'cible@bae.test' })
    ).create()

    const result = await emit({
      verb: 'presence.pending',
      subjectType: 'event',
      subjectId: 3,
      payload: { subject: 'Réponds', lines: ['Merci de répondre.'] },
      recipients: [member.id],
    })

    const command = await ace.create(NotifyDispatch, [])
    await command.exec()
    command.assertSucceeded()

    const sent = fake.mails.sent()
    assert.lengthOf(sent, 1)
    assert.deepEqual(sent[0].message.toJSON().message.to, ['cible@bae.test'])

    const row = await Notification.query().where('eventId', result.eventId).firstOrFail()
    assert.isNotNull(row.sentAt, 'une livraison envoyée est horodatée')

    mail.restore()
  })

  test('ne renvoie pas une livraison déjà envoyée', async ({ assert }) => {
    const fake = mail.fake()
    const member = await MemberFactory.create()

    const result = await emit({
      verb: 'presence.pending',
      subjectType: 'event',
      subjectId: 4,
      recipients: [member.id],
    })
    await Notification.query()
      .where('eventId', result.eventId)
      .update({ sent_at: DateTime.now().toSQL() })

    const command = await ace.create(NotifyDispatch, [])
    await command.exec()

    assert.lengthOf(fake.mails.sent(), 0)

    mail.restore()
  })

  test('--dry-run n’envoie rien et n’horodate rien', async ({ assert }) => {
    const fake = mail.fake()
    const member = await MemberFactory.create()
    const result = await emit({
      verb: 'presence.pending',
      subjectType: 'event',
      subjectId: 5,
      recipients: [member.id],
    })

    const command = await ace.create(NotifyDispatch, ['--dry-run'])
    await command.exec()
    command.assertSucceeded()

    assert.lengthOf(fake.mails.sent(), 0)
    const row = await Notification.query().where('eventId', result.eventId).firstOrFail()
    assert.isNull(row.sentAt)

    mail.restore()
  })
})
