import { test } from '@japa/runner'
import { renderDeliveries } from '#services/notification_renderer'
import type { Delivery, Personalizer } from '#services/notification_renderer'

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
