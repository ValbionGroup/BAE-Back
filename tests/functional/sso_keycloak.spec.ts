import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import Client from '#models/client'
import Member from '#models/member'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { isSsoApp, provision } from '#services/sso_provisioning_service'
import type { SsoClaims } from '#services/oidc_service'

function claimsFor(overrides: Partial<SsoClaims> = {}): SsoClaims {
  const unique = Math.random().toString(36).slice(2, 10)
  return {
    subject: `sub-${unique}`,
    casId: `uid-${unique}`,
    email: `${unique}@bordeaux-inp.fr`,
    firstName: 'Tom',
    lastName: 'Test',
    school: 'ENSEIRB-MATMECA',
    degree: '3A Informatique',
    ...overrides,
  }
}

test.group('SSO — validation de la zone', () => {
  test('n’accepte que les deux zones connues', ({ assert }) => {
    assert.isTrue(isSsoApp('dashboard'))
    assert.isTrue(isSsoApp('public'))
    // Une valeur libre ici ouvrirait la porte à une redirection non contrôlée.
    assert.isFalse(isSsoApp('https://evil.example'))
    assert.isFalse(isSsoApp(''))
    assert.isFalse(isSsoApp(undefined))
  })
})

test.group('SSO — résolution de l’utilisateur en trois temps', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('lie un compte existant au lieu d’en créer un second', async ({ assert }) => {
    // Un membre du BAE, déjà en base, qui se connecte au SSO pour la première fois.
    const member = await MemberFactory.create()
    const existing = await User.findOrFail(member.id)
    existing.casId = 'uid-deja-la'
    await existing.save()

    const before = await db.from('users').count('* as total').first()

    const outcome = await provision('dashboard', claimsFor({ casId: 'uid-deja-la' }))

    const after = await db.from('users').count('* as total').first()

    assert.equal(outcome.status, 'ok')
    assert.equal(outcome.user.id, existing.id, 'c’est le MÊME compte, pas un nouveau')
    assert.equal(
      Number(after!.total),
      Number(before!.total),
      'créer un second compte priverait le membre de son rôle, ses points et son historique'
    )

    const reloaded = await User.findOrFail(existing.id)
    assert.isNotNull(reloaded.keycloakSub, 'le compte doit désormais porter le lien vers l’IdP')
  })

  test('retrouve un utilisateur déjà lié par son keycloak_sub', async ({ assert }) => {
    const member = await MemberFactory.create()
    const existing = await User.findOrFail(member.id)
    existing.keycloakSub = 'sub-connu'
    await existing.save()

    const outcome = await provision('dashboard', claimsFor({ subject: 'sub-connu' }))

    assert.equal(outcome.user.id, existing.id)
  })

  test('l’email n’est jamais une clé de recherche, mais il est mis à jour', async ({ assert }) => {
    const member = await MemberFactory.create()
    const existing = await User.findOrFail(member.id)
    existing.casId = 'uid-email-change'
    await existing.save()
    const oldEmail = existing.email

    const outcome = await provision(
      'dashboard',
      claimsFor({ casId: 'uid-email-change', email: 'nouvelle.adresse@bordeaux-inp.fr' })
    )

    assert.equal(outcome.user.id, existing.id)
    assert.notEqual(outcome.user.email, oldEmail)
    assert.equal(outcome.user.email, 'nouvelle.adresse@bordeaux-inp.fr')
  })
})

test.group('SSO — les deux zones ont des politiques opposées', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('dashboard : refuse un compte sans ligne members, et ne provisionne rien', async ({
    assert,
  }) => {
    const outcome = await provision('dashboard', claimsFor())

    assert.equal(outcome.status, 'not-a-member')
    const member = await Member.find(outcome.user.id)
    assert.isNull(member, 'le dashboard ne crée jamais de membre')
    const client = await Client.find(outcome.user.id)
    assert.isNull(client, 'ni de client')
  })

  test('dashboard : laisse entrer un compte qui a une ligne members', async ({ assert }) => {
    const member = await MemberFactory.create()
    const existing = await User.findOrFail(member.id)
    existing.casId = 'uid-vrai-membre'
    await existing.save()

    const outcome = await provision('dashboard', claimsFor({ casId: 'uid-vrai-membre' }))

    assert.equal(outcome.status, 'ok')
  })

  test('public : crée la ligne clients si elle manque — le JIT provisioning', async ({
    assert,
  }) => {
    const outcome = await provision('public', claimsFor())

    assert.equal(outcome.status, 'ok')
    const client = await Client.find(outcome.user.id)
    assert.isNotNull(client, 'c’est l’unique chemin de création d’un compte client')
    const member = await Member.find(outcome.user.id)
    assert.isNull(member, 'être client n’est pas être membre')
  })

  test('public : ne recrée pas une ligne clients déjà là', async ({ assert }) => {
    const first = await provision(
      'public',
      claimsFor({ casId: 'uid-repeat', subject: 'sub-repeat' })
    )
    // Témoin volontairement pris hors des champs dérivés de l'IdP : `promotion`
    // et `school` sont réécrits à chaque connexion, ils ne prouveraient rien.
    await Client.query()
      .where('id', first.user.id)
      .update({ preparation_note: 'Sans gluten', registered_at: DateTime.now().toSQLDate() })

    await provision('public', claimsFor({ casId: 'uid-repeat', subject: 'sub-repeat' }))

    const client = await Client.findOrFail(first.user.id)
    assert.equal(
      client.preparationNote,
      'Sans gluten',
      'les données saisies ne doivent pas être écrasées'
    )
  })

  test('public : la première connexion renseigne école et promotion', async ({ assert }) => {
    const outcome = await provision('public', claimsFor({ school: 'ENSCBP', degree: '2A Agro' }))

    const client = await Client.findOrFail(outcome.user.id)
    assert.equal(client.school, 'ENSCBP')
    assert.equal(client.promotion, '2A Agro')
  })

  /**
   * L'inverse de ce que ce fichier affirmait jusqu'ici. `promotion` dérive
   * désormais du claim `diplome` : une saisie du bureau ne fait plus autorité,
   * et le champ a été retiré du validateur pour que personne ne la tente.
   */
  test('public : une reconnexion réaligne promotion et école sur les claims', async ({
    assert,
  }) => {
    const first = await provision(
      'public',
      claimsFor({
        casId: 'uid-derive',
        subject: 'sub-derive',
        degree: '2A Info',
        school: 'ENSEIRB',
      })
    )
    await Client.query()
      .where('id', first.user.id)
      .update({ promotion: 'saisie du bureau', school: 'saisie du bureau' })

    await provision(
      'public',
      claimsFor({
        casId: 'uid-derive',
        subject: 'sub-derive',
        degree: '3A Info',
        school: 'ENSEIRB',
      })
    )

    const client = await Client.findOrFail(first.user.id)
    assert.equal(client.promotion, '3A Info')
    assert.equal(client.school, 'ENSEIRB')
  })

  test('public : un claim absent ne vide pas la colonne', async ({ assert }) => {
    const first = await provision(
      'public',
      claimsFor({ casId: 'uid-vide', subject: 'sub-vide', degree: '4A Info', school: 'ENSEIRB' })
    )

    // Un mapper muet côté DSI est une information manquante, pas un ordre
    // d'effacement : écrire `null` ici viderait la fiche sans laisser de trace.
    await provision(
      'public',
      claimsFor({ casId: 'uid-vide', subject: 'sub-vide', degree: null, school: null })
    )

    const client = await Client.findOrFail(first.user.id)
    assert.equal(client.promotion, '4A Info')
    assert.equal(client.school, 'ENSEIRB')
  })

  test('une même personne peut être membre ET cliente', async ({ assert }) => {
    const member = await MemberFactory.create()
    const existing = await User.findOrFail(member.id)
    existing.casId = 'uid-les-deux'
    await existing.save()

    const outcome = await provision('public', claimsFor({ casId: 'uid-les-deux' }))

    assert.equal(outcome.user.id, existing.id)
    assert.isNotNull(await Member.find(existing.id))
    assert.isNotNull(await Client.find(existing.id))
  })
})

test.group('Gardes d’audience — la sécurité réelle', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('un client authentifié n’atteint pas les routes du dashboard', async ({
    client: httpClient,
    assert,
  }) => {
    // Exactement ce que produit une connexion SSO côté public : un `user` avec
    // une ligne `clients`, et aucune ligne `members`.
    const outcome = await provision('public', claimsFor())
    assert.equal(outcome.status, 'ok')

    const response = await httpClient.get('/v1/members').loginAs(outcome.user)

    // ⚠️ Le lieu de connexion ne protège rien : les trois origines partagent un
    // domaine, donc le cookie voyage. C'est CE garde qui sépare les deux zones.
    response.assertStatus(403)
  })

  test('un membre atteint bien les routes du dashboard', async ({ client: httpClient, assert }) => {
    const member = await MemberFactory.create()
    const user = await grantPermissions(member, ['member:read'])

    const response = await httpClient.get('/v1/members').loginAs(user)

    assert.notEqual(response.status(), 403)
  })
})
