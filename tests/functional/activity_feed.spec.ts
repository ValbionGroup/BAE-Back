import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { emit, recordEvent } from '#services/notification_service'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'

test.group('Fil d’activité', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('rend les actions humaines, avec le nom de leur auteur', async ({ client, assert }) => {
    const author = await MemberFactory.with('user', 1, (u) =>
      u.merge({ firstName: 'Léa', lastName: 'Martin' })
    ).create()
    const reader = await grantPermissions(await MemberFactory.create(), [])

    await recordEvent({
      verb: 'production.launched',
      actorId: author.id,
      subjectType: 'event',
      subjectId: 42,
      payload: { what: 'a lancé la production de', emphasis: 'Hot-dog' },
    })

    const response = await client.get('/v1/activity').loginAs(reader)
    response.assertStatus(200)

    const rows = (response.body() as { data: { actor_name: string; verb: string }[] }).data
    const mine = rows.find((row) => row.verb === 'production.launched')

    assert.isDefined(mine)
    assert.equal(mine!.actor_name, 'Léa Martin')
  })

  /**
   * ⚠️ L'invariant du fil : il montre ce que **l'équipe** a fait. Les rappels
   * automatiques vivent dans la même table sans auteur ; les afficher donnerait
   * « le système a rappelé la présence » et noierait les vraies actions.
   */
  test('n’affiche pas les faits sans auteur', async ({ client, assert }) => {
    const target = await MemberFactory.create()
    const reader = await grantPermissions(await MemberFactory.create(), [])

    await emit({
      verb: 'presence.pending',
      subjectType: 'event',
      subjectId: 4242,
      recipients: [target.id],
    })

    const response = await client.get('/v1/activity').loginAs(reader)
    const rows = (response.body() as { data: { subject_id: number }[] }).data

    assert.notInclude(
      rows.map((row) => row.subject_id),
      4242,
      'un rappel automatique n’est pas de l’activité d’équipe'
    )
  })

  test('exige une authentification', async ({ client }) => {
    const response = await client.get('/v1/activity')

    response.assertStatus(401)
  })
})
