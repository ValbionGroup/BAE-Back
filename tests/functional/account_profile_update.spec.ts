import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import { UserFactory } from '#database/factories/user_factory'
import Client from '#models/client'

type ProfileBody = {
  data: {
    client: {
      promotion: string | null
      school: string | null
      registered_at: string | null
      preparation_note: string | null
    } | null
    user: {
      telegram: { handle: string | null; linked: boolean; linked_at: string | null }
    }
  }
}

test.group('Profil client — lecture', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('le profil porte les coordonnées du client', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await Client.create({
      id: user.id,
      registeredAt: DateTime.now(),
      promotion: 'I2',
      preparationNote: 'Allergie arachide',
    })

    const response = await client.get('/v1/account/profile').loginAs(user)

    response.assertStatus(200)
    const { client: profile, user: me } = response.body().data as ProfileBody['data']
    assert.equal(profile?.preparation_note, 'Allergie arachide')
    assert.notProperty(profile, 'phone')
    assert.isFalse(me.telegram.linked)
  })

  /**
   * `note` est la note du bureau **sur** le client, signée par son auteur. La lui
   * renvoyer serait une fuite : c'est le seul test qui garde cette frontière côté
   * lecture.
   */
  test('le profil ne divulgue ni la note du bureau ni le chat id', async ({ client, assert }) => {
    const user = await UserFactory.create()
    await Client.create({
      id: user.id,
      registeredAt: DateTime.now(),
      note: 'Mauvais payeur',
    })

    const response = await client.get('/v1/account/profile').loginAs(user)

    const { client: profile, user: me } = response.body().data as ProfileBody['data']
    assert.notProperty(profile, 'note')
    assert.notProperty(profile, 'note_author_id')
    assert.notProperty(me, 'telegram_chat_id')
  })

  test('un utilisateur sans ligne client obtient client: null, pas une erreur', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()

    const response = await client.get('/v1/account/profile').loginAs(user)

    response.assertStatus(200)
    const { client: profile } = response.body().data as ProfileBody['data']
    assert.isNull(profile)
  })
})

test.group('Profil client — écriture', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function aClient() {
    const user = await UserFactory.create()
    const row = await Client.create({
      id: user.id,
      registeredAt: DateTime.now(),
      preparationNote: 'Sans gluten',
    })
    return { user, row }
  }

  test('une clé absente ne touche pas les autres champs', async ({ client, assert }) => {
    const { user, row } = await aClient()

    const response = await client
      .patch('/v1/account/profile')
      .json({ telegram_handle: 'nouveau_pseudo' })
      .loginAs(user)

    response.assertStatus(200)
    await row.refresh()
    assert.equal(row.preparationNote, 'Sans gluten')
  })

  test('null efface le champ', async ({ client, assert }) => {
    const { user, row } = await aClient()

    await client.patch('/v1/account/profile').json({ preparation_note: null }).loginAs(user)

    await row.refresh()
    assert.isNull(row.preparationNote)
  })

  /** Une chaîne vide vient d'un champ qu'on vide : c'est un effacement, pas un texte. */
  test('une chaîne vide efface plutôt que de stocker du vide', async ({ client, assert }) => {
    const { user, row } = await aClient()

    await client.patch('/v1/account/profile').json({ preparation_note: '' }).loginAs(user)

    await row.refresh()
    assert.isNull(row.preparationNote)
  })

  /** Le pseudo a suivi la liaison sur `users` : il n'est plus sur la ligne `clients`. */
  test('le pseudo Telegram est stocké sans son arobase', async ({ client, assert }) => {
    const { user } = await aClient()

    const response = await client
      .patch('/v1/account/profile')
      .json({ telegram_handle: '@lea_m' })
      .loginAs(user)

    response.assertStatus(200)
    await user.refresh()
    assert.equal(user.telegramHandle, 'lea_m')
    assert.equal(response.body().data.user.telegram.handle, 'lea_m')
  })

  test('vider le champ Telegram retire le pseudo', async ({ client, assert }) => {
    const { user } = await aClient()
    user.telegramHandle = 'lea_m'
    await user.save()

    const response = await client
      .patch('/v1/account/profile')
      .json({ telegram_handle: '' })
      .loginAs(user)

    response.assertStatus(200)
    await user.refresh()
    assert.isNull(user.telegramHandle)
  })

  test('un pseudo Telegram invalide est refusé', async ({ client }) => {
    const { user } = await aClient()

    const response = await client
      .patch('/v1/account/profile')
      .json({ telegram_handle: 'a-b' })
      .loginAs(user)

    response.assertStatus(422)
  })

  test('une consigne de plus de 500 caractères est refusée', async ({ client }) => {
    const { user } = await aClient()

    const response = await client
      .patch('/v1/account/profile')
      .json({ preparation_note: 'a'.repeat(501) })
      .loginAs(user)

    response.assertStatus(422)
  })

  /**
   * Le garde-fou central : `note` appartient au bureau. Qu'un client la porte
   * dans son corps de requête ne doit jamais l'atteindre.
   */
  test('un corps portant note laisse intacte la note du bureau', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const row = await Client.create({
      id: user.id,
      registeredAt: DateTime.now(),
      note: 'Note du bureau',
    })

    await client.patch('/v1/account/profile').json({ note: 'effacée par moi' }).loginAs(user)

    await row.refresh()
    assert.equal(row.note, 'Note du bureau')
  })

  test('un compte sans ligne client ne peut pas écrire', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client
      .patch('/v1/account/profile')
      .json({ preparation_note: 'Sans gluten' })
      .loginAs(user)

    response.assertStatus(403)
  })

  test('sans session, la route refuse', async ({ client }) => {
    const response = await client
      .patch('/v1/account/profile')
      .json({ preparation_note: 'Sans gluten' })

    response.assertStatus(401)
  })
})
