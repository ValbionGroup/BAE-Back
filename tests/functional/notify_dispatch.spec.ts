import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import ace from '@adonisjs/core/services/ace'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import Notification from '#models/notification'
import db from '@adonisjs/lucid/services/db'
import { emit } from '#services/notification_service'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'
import NotifyDispatch from '../../commands/notify_dispatch.js'

test.group('notify:dispatch', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('le mail porte le poste du membre', async ({ assert }) => {
    const fake = mail.fake()
    const event = await EventFactory.merge({
      date: DateTime.now().plus({ days: 1 }),
      status: 'scheduled',
    }).create()
    const member = await MemberFactory.with('user', 1, (u) =>
      u.merge({ email: 'demain@bae.test' })
    ).create()
    const job = await JobFactory.merge({ name: 'Bar', type: 'during' }).create()

    await db.table('member_event_assigned_jobs').insert([
      {
        member_id: member.id,
        event_id: event.id,
        job_id: job.id,
        locked: false,
        points_delta: 0,
      },
    ])

    await emit({
      verb: 'presence.tomorrow',
      subjectType: 'event',
      subjectId: event.id,
      payload: { subject: "C'est demain", lines: [`${event.name}. Voici ton poste.`] },
      recipients: [member.id],
      dedupeKey: `presence.tomorrow:${event.id}`,
    })

    const command = await ace.create(NotifyDispatch, [])
    await command.exec()
    command.assertSucceeded()

    const mine = fake.mails
      .sent()
      .find((m) => m.message.toJSON().message.to?.[0] === 'demain@bae.test')
    assert.exists(mine, 'un mail est parti au membre affecté')
    assert.include(mine!.message.toJSON().message.text, 'Ton poste : Bar — Pendant · Service')

    mail.restore()
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
