import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { grantPermissions } from '#tests/helpers/permissions'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'

/**
 * Le héros de l'accueil annonce « N membres affectés » sur la prochaine soirée.
 * Il le reconstituait à partir de `GET /assignments`, que la coordination seule
 * peut lire : un membre ordinaire y voyait « 0 membres affectés », un chiffre
 * faux annoncé avec aplomb. Le compte appartient à la soirée, il y vit désormais.
 */
test.group('Events — effectif affecté', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('compte les personnes, pas les postes', async ({ client, assert }) => {
    const event = await EventFactory.create()
    const first = await MemberFactory.create()
    const second = await MemberFactory.create()
    const barman = await JobFactory.create()
    const cleaning = await JobFactory.create()

    // La première tient deux postes : elle ne doit compter qu'une fois.
    for (const [memberId, jobId] of [
      [first.id, barman.id],
      [first.id, cleaning.id],
      [second.id, barman.id],
    ]) {
      await MemberEventAssignedJob.create({
        memberId,
        eventId: event.id,
        jobId,
        locked: false,
        pointsDelta: 0,
      })
    }

    // `event:read` seule : elle est dans BASE, donc tout rôle la porte.
    const plain = await grantPermissions(await MemberFactory.create(), ['event:read'])
    const response = await client.get('/v1/events').loginAs(plain)

    response.assertStatus(200)
    const body = response.body() as { data: Array<{ id: number; assignee_count: number }> }
    const row = body.data.find((candidate) => candidate.id === event.id)
    assert.equal(row?.assignee_count, 2)
  })

  test('vaut zéro sur une soirée que personne ne tient', async ({ client, assert }) => {
    const event = await EventFactory.create()
    // `event:read` seule : elle est dans BASE, donc tout rôle la porte.
    const plain = await grantPermissions(await MemberFactory.create(), ['event:read'])

    const response = await client.get('/v1/events').loginAs(plain)

    const body = response.body() as { data: Array<{ id: number; assignee_count: number }> }
    const row = body.data.find((candidate) => candidate.id === event.id)
    assert.equal(row?.assignee_count, 0)
  })
})
