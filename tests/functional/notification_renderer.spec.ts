import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { assignmentLines, renderDeliveries } from '#services/notification_renderer'
import type { Delivery, Personalizer } from '#services/notification_renderer'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'

function delivery(over: Partial<Delivery> = {}): Delivery {
  return {
    id: 1,
    userId: 10,
    verb: 'presence.pending',
    subjectId: 100,
    payload: { subject: 'Réponds', lines: ['La soirée approche.'] },
    ...over,
  }
}

test.group('renderDeliveries', () => {
  test('un verbe hors registre rend le payload du fait, inchangé', async ({ assert }) => {
    const rendered = await renderDeliveries([delivery()], {})

    assert.deepEqual(rendered.get(1), {
      subject: 'Réponds',
      lines: ['La soirée approche.'],
    })
  })

  test('un payload absent retombe sur le défaut de readNotificationPayload', async ({ assert }) => {
    const rendered = await renderDeliveries([delivery({ payload: null })], {})

    assert.deepEqual(rendered.get(1), { subject: 'Notification BAE', lines: [] })
  })

  test('un payload sérialisé en chaîne est lu comme un objet', async ({ assert }) => {
    const raw = JSON.stringify({ subject: 'Sujet', lines: ['Une ligne.'] })
    const rendered = await renderDeliveries([delivery({ payload: raw })], {})

    assert.deepEqual(rendered.get(1), { subject: 'Sujet', lines: ['Une ligne.'] })
  })

  test('les lignes du personnalisateur sont ajoutées après celles du fait', async ({ assert }) => {
    const personalizer: Personalizer = async (_subjectId, userIds) =>
      new Map(userIds.map((id) => [id, [`Ligne de ${id}.`]]))

    const rendered = await renderDeliveries([delivery()], {
      'presence.pending': personalizer,
    })

    assert.deepEqual(rendered.get(1), {
      subject: 'Réponds',
      lines: ['La soirée approche.', 'Ligne de 10.'],
    })
  })

  /**
   * Trente destinataires d'une même soirée ne font pas trente requêtes : le
   * personnalisateur est appelé une fois par couple (verbe, sujet).
   */
  test('regroupe par verbe et par sujet : un appel par groupe', async ({ assert }) => {
    const calls: { subjectId: number; userIds: number[] }[] = []
    const personalizer: Personalizer = async (subjectId, userIds) => {
      calls.push({ subjectId, userIds: [...userIds] })
      return new Map(userIds.map((id) => [id, [`#${id}`]]))
    }

    await renderDeliveries(
      [
        delivery({ id: 1, userId: 10, subjectId: 100 }),
        delivery({ id: 2, userId: 11, subjectId: 100 }),
        delivery({ id: 3, userId: 12, subjectId: 200 }),
      ],
      { 'presence.pending': personalizer }
    )

    assert.lengthOf(calls, 2)
    assert.deepEqual(calls[0], { subjectId: 100, userIds: [10, 11] })
    assert.deepEqual(calls[1], { subjectId: 200, userIds: [12] })
  })

  test("un destinataire absent de la réponse du personnalisateur n'a pas de ligne en plus", async ({
    assert,
  }) => {
    const personalizer: Personalizer = async () => new Map()

    const rendered = await renderDeliveries([delivery()], {
      'presence.pending': personalizer,
    })

    assert.deepEqual(rendered.get(1)?.lines, ['La soirée approche.'])
  })
})

test.group('assignmentLines', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('rend les postes du membre en ordre chronologique', async ({ assert }) => {
    const event = await EventFactory.merge({
      date: DateTime.now().plus({ days: 1 }),
      status: 'scheduled',
    }).create()
    const member = await MemberFactory.create()
    const menage = await JobFactory.merge({ name: 'Balai', type: 'after' }).create()
    const prepa = await JobFactory.merge({ name: 'Épluchage', type: 'before' }).create()

    await db.table('member_event_assigned_jobs').insert([
      {
        member_id: member.id,
        event_id: event.id,
        job_id: menage.id,
        locked: false,
        points_delta: 0,
      },
      {
        member_id: member.id,
        event_id: event.id,
        job_id: prepa.id,
        locked: false,
        points_delta: 0,
      },
    ])

    const lines = await assignmentLines(event.id, [member.id])

    assert.deepEqual(lines.get(member.id), [
      'Ton poste : Épluchage — Avant · Préparation',
      'Ton poste : Balai — Après · Nettoyage',
    ])
  })

  test('un membre sans poste reçoit la ligne de repli', async ({ assert }) => {
    const event = await EventFactory.merge({
      date: DateTime.now().plus({ days: 1 }),
      status: 'scheduled',
    }).create()
    const member = await MemberFactory.create()

    const lines = await assignmentLines(event.id, [member.id])

    assert.deepEqual(lines.get(member.id), ["Aucun poste ne t'est attribué pour l'instant."])
  })

  /**
   * La base de dev est partagée et peuplée : un membre affecté ailleurs ne doit
   * pas contaminer la soirée demandée.
   */
  test("ignore les affectations d'une autre soirée", async ({ assert }) => {
    const [event, other] = await EventFactory.merge({
      date: DateTime.now().plus({ days: 1 }),
      status: 'scheduled',
    }).createMany(2)
    const member = await MemberFactory.create()
    const job = await JobFactory.merge({ name: 'Bar', type: 'during' }).create()

    await db.table('member_event_assigned_jobs').insert([
      {
        member_id: member.id,
        event_id: other.id,
        job_id: job.id,
        locked: false,
        points_delta: 0,
      },
    ])

    const lines = await assignmentLines(event.id, [member.id])

    assert.deepEqual(lines.get(member.id), ["Aucun poste ne t'est attribué pour l'instant."])
  })
})
