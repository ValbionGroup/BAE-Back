import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import MemberEventAssignedJob from '#models/member_event_assigned_job'
import { MemberFactory } from '#database/factories/members_factory'
import { EventFactory } from '#database/factories/event_factory'
import { JobFactory } from '#database/factories/job_factory'

/**
 * Le panneau « mon rôle » de l'accueil se nourrissait de `loadAll()` — sept
 * requêtes de coordination, dont quatre derrière `job:read`. Un membre ordinaire
 * ne pouvait donc pas voir sa propre affectation.
 *
 * Ce que l'écran demande vraiment tient en une phrase : mes postes, qui d'autre
 * y est, et combien il en faut. Tout est ou bien à moi, ou bien à propos d'un
 * poste que je tiens — rien qui justifie une permission d'administration.
 */
test.group('Mes affectations', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function scene() {
    const me = await MemberFactory.create()
    const event = await EventFactory.create()
    const job = await JobFactory.merge({ name: 'Barman', type: 'during' }).create()
    return { me, user: await User.findOrFail(me.id), event, job }
  }

  test('un membre sans permission lit ses propres postes', async ({ client, assert }) => {
    const { me, user, event, job } = await scene()
    await MemberEventAssignedJob.create({
      memberId: me.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: -3,
    })

    const response = await client.get('/v1/account/assignments').loginAs(user)

    response.assertStatus(200)
    const body = response.body() as {
      data: Array<{ event_id: number; job_name: string; job_type: string; points_delta: number }>
    }
    assert.lengthOf(body.data, 1)
    assert.equal(body.data[0].event_id, event.id)
    assert.equal(body.data[0].job_name, 'Barman')
    assert.equal(body.data[0].job_type, 'during')
    // Un bon rang COÛTE du crédit : négatif est normal, jamais une erreur.
    assert.equal(body.data[0].points_delta, -3)
  })

  test('ne renvoie que les miennes', async ({ client, assert }) => {
    const { me, user, event, job } = await scene()
    const other = await MemberFactory.create()
    const otherJob = await JobFactory.merge({ name: 'Caisse' }).create()

    await MemberEventAssignedJob.create({
      memberId: me.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 0,
    })
    await MemberEventAssignedJob.create({
      memberId: other.id,
      eventId: event.id,
      jobId: otherJob.id,
      locked: false,
      pointsDelta: 0,
    })

    const response = await client.get('/v1/account/assignments').loginAs(user)

    const body = response.body() as { data: Array<{ job_name: string }> }
    assert.deepEqual(
      body.data.map((row) => row.job_name),
      ['Barman']
    )
  })

  test('nomme les coéquipiers du poste, et pas les autres', async ({ client, assert }) => {
    const { me, user, event, job } = await scene()
    const mate = await MemberFactory.create()
    const stranger = await MemberFactory.create()
    const otherJob = await JobFactory.merge({ name: 'Caisse' }).create()

    for (const [memberId, jobId] of [
      [me.id, job.id],
      [mate.id, job.id],
      [stranger.id, otherJob.id],
    ]) {
      await MemberEventAssignedJob.create({
        memberId,
        eventId: event.id,
        jobId,
        locked: false,
        pointsDelta: 0,
      })
    }

    const response = await client.get('/v1/account/assignments').loginAs(user)

    const body = response.body() as {
      data: Array<{ teammates: Array<{ id: number }> }>
    }
    assert.deepEqual(
      body.data[0].teammates.map((teammate) => teammate.id),
      [mate.id]
    )
  })

  test('donne l’effectif attendu du poste, et null quand il n’est pas fixé', async ({
    client,
    assert,
  }) => {
    const { me, user, event, job } = await scene()
    await event.related('jobs').sync({ [job.id]: { count: 4 } }, false)
    await MemberEventAssignedJob.create({
      memberId: me.id,
      eventId: event.id,
      jobId: job.id,
      locked: false,
      pointsDelta: 0,
    })

    const response = await client.get('/v1/account/assignments').loginAs(user)

    const body = response.body() as { data: Array<{ needed: number | null }> }
    assert.equal(body.data[0].needed, 4)
  })

  test('exige d’être connecté', async ({ client }) => {
    const response = await client.get('/v1/account/assignments')
    response.assertStatus(401)
  })
})
