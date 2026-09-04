import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import ace from '@adonisjs/core/services/ace'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Notification from '#models/notification'
import ActivityEvent from '#models/activity_event'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import NotifyPresencePending from '../../commands/notify_presence_pending.js'
import NotifyPresenceUpcoming from '../../commands/notify_presence_upcoming.js'
import NotifyPresenceTomorrow from '../../commands/notify_presence_tomorrow.js'

/**
 * ⚠️ La base de dev est partagée et peuplée : aucune assertion sur un compte
 * global. Chaque test ne compte que les lignes rattachées à SA soirée.
 *
 * ⚠️ `EventFactory` **déduit** désormais `status` de la date, et sa date est
 * toujours future : une soirée fabriquée est donc `scheduled`. Le tirage
 * aléatoire d'avant faisait réussir deux tests sur trois pour la mauvaise
 * raison (le statut, pas la fenêtre). Un test qui dépend du statut le fixe
 * quand même explicitement — c'est ce qu'il affirme qui doit être lisible.
 */
async function runCommand(commandClass: Parameters<typeof ace.create>[0]): Promise<void> {
  const command = await ace.create(commandClass, [])
  await command.exec()
  command.assertSucceeded()
}

async function recipientsFor(eventId: number, verb: string): Promise<number[]> {
  const events = await ActivityEvent.query()
    .where('subjectType', 'event')
    .where('subjectId', eventId)
    .where('verb', verb)

  if (events.length === 0) return []

  const rows = await Notification.query().whereIn(
    'eventId',
    events.map((event) => event.id)
  )
  return rows.map((row) => row.userId)
}

test.group('notify:presence-pending', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('ne vise que les membres sans réponse', async ({ assert }) => {
    const event = await EventFactory.merge({
      date: DateTime.now().plus({ days: 2 }),
      status: 'scheduled',
    }).create()
    const silent = await MemberFactory.create()
    const answeredNo = await MemberFactory.create()
    const answeredYes = await MemberFactory.create()

    await db.table('member_responses').insert([
      { member_id: answeredNo.id, event_id: event.id, is_available: false },
      { member_id: answeredYes.id, event_id: event.id, is_available: true },
    ])

    const command = await ace.create(NotifyPresencePending, [])
    await command.exec()
    command.assertSucceeded()

    const targets = await recipientsFor(event.id, 'presence.pending')

    assert.include(targets, silent.id)
    assert.notInclude(
      targets,
      answeredNo.id,
      'a répondu NON : lui écrire « tu n’as pas répondu » est le bug à éviter'
    )
    assert.notInclude(targets, answeredYes.id)
  })

  test('rejouer la commande ne crée pas de second envoi', async ({ assert }) => {
    const event = await EventFactory.merge({
      date: DateTime.now().plus({ days: 2 }),
      status: 'scheduled',
    }).create()
    await MemberFactory.create()

    await runCommand(NotifyPresencePending)
    const first = await recipientsFor(event.id, 'presence.pending')

    await runCommand(NotifyPresencePending)
    const second = await recipientsFor(event.id, 'presence.pending')

    assert.equal(second.length, first.length, 'le rejeu doit être absorbé')
  })

  test('ignore une soirée hors fenêtre', async ({ assert }) => {
    const far = await EventFactory.merge({
      date: DateTime.now().plus({ days: 40 }),
      status: 'scheduled',
    }).create()
    await MemberFactory.create()

    await runCommand(NotifyPresencePending)

    assert.lengthOf(await recipientsFor(far.id, 'presence.pending'), 0)
  })

  test('ignore une soirée déjà passée', async ({ assert }) => {
    const past = await EventFactory.merge({
      date: DateTime.now().minus({ days: 1 }),
      status: 'scheduled',
    }).create()
    await MemberFactory.create()

    await runCommand(NotifyPresencePending)

    assert.lengthOf(await recipientsFor(past.id, 'presence.pending'), 0)
  })

  test('--dry-run n’écrit rien', async ({ assert }) => {
    const event = await EventFactory.merge({
      date: DateTime.now().plus({ days: 2 }),
      status: 'scheduled',
    }).create()
    await MemberFactory.create()

    const command = await ace.create(NotifyPresencePending, ['--dry-run'])
    await command.exec()
    command.assertSucceeded()

    assert.lengthOf(await recipientsFor(event.id, 'presence.pending'), 0)
  })
})

test.group('notify:presence-upcoming', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('ne vise que les membres ayant répondu présent', async ({ assert }) => {
    const event = await EventFactory.merge({
      date: DateTime.now().plus({ days: 2 }),
      status: 'scheduled',
    }).create()
    const going = await MemberFactory.create()
    const notGoing = await MemberFactory.create()
    const silent = await MemberFactory.create()

    await db.table('member_responses').insert([
      { member_id: going.id, event_id: event.id, is_available: true },
      { member_id: notGoing.id, event_id: event.id, is_available: false },
    ])

    const command = await ace.create(NotifyPresenceUpcoming, [])
    await command.exec()
    command.assertSucceeded()

    const targets = await recipientsFor(event.id, 'presence.upcoming')

    assert.include(targets, going.id)
    assert.notInclude(targets, notGoing.id)
    assert.notInclude(targets, silent.id, 'sans réponse ≠ participant')
  })

  test('les deux rappels sont indépendants sur la même soirée', async ({ assert }) => {
    const event = await EventFactory.merge({
      date: DateTime.now().plus({ days: 2 }),
      status: 'scheduled',
    }).create()
    const going = await MemberFactory.create()
    const silent = await MemberFactory.create()

    await db
      .table('member_responses')
      .insert({ member_id: going.id, event_id: event.id, is_available: true })

    await runCommand(NotifyPresencePending)
    await runCommand(NotifyPresenceUpcoming)

    const pending = await recipientsFor(event.id, 'presence.pending')
    const upcoming = await recipientsFor(event.id, 'presence.upcoming')

    assert.include(pending, silent.id)
    assert.include(upcoming, going.id)
    assert.notInclude(
      upcoming,
      silent.id,
      'un dedupeKey par verbe : les deux rappels ne doivent pas se confondre'
    )
  })
})

test.group('notify:presence-tomorrow', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  async function comingTo(hoursAhead: number) {
    const event = await EventFactory.merge({
      date: DateTime.now().plus({ hours: hoursAhead }),
      status: 'scheduled',
    }).create()
    const member = await MemberFactory.create()
    await db
      .table('member_responses')
      .insert([{ member_id: member.id, event_id: event.id, is_available: true }])
    return { event, member }
  }

  test('vise les membres présents sur une soirée de demain', async ({ assert }) => {
    const { event, member } = await comingTo(20)

    await runCommand(NotifyPresenceTomorrow)

    assert.include(await recipientsFor(event.id, 'presence.tomorrow'), member.id)
  })

  test('ignore une soirée à trois jours', async ({ assert }) => {
    const { event } = await comingTo(72)

    await runCommand(NotifyPresenceTomorrow)

    assert.isEmpty(await recipientsFor(event.id, 'presence.tomorrow'))
  })

  /**
   * Deux verbes, deux clés. Si le J-3 inhibait le J-1, ce test tomberait — et
   * personne ne recevrait le rappel de la veille.
   */
  test('cohabite avec presence.upcoming sur la même soirée', async ({ assert }) => {
    const { event, member } = await comingTo(20)

    await runCommand(NotifyPresenceUpcoming)
    await runCommand(NotifyPresenceTomorrow)

    assert.include(await recipientsFor(event.id, 'presence.upcoming'), member.id)
    assert.include(await recipientsFor(event.id, 'presence.tomorrow'), member.id)
  })

  test('ne met pas en file deux fois', async ({ assert }) => {
    const { event, member } = await comingTo(20)

    await runCommand(NotifyPresenceTomorrow)
    await runCommand(NotifyPresenceTomorrow)

    const targets = await recipientsFor(event.id, 'presence.tomorrow')
    assert.lengthOf(
      targets.filter((id) => id === member.id),
      1
    )
  })
})
