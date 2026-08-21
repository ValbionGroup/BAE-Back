import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import type Member from '#models/member'
import { MemberFactory } from '#database/factories/members_factory'
import { errorCodeOf } from '#tests/helpers/api_error'
import { clearLimits } from '#tests/helpers/limiter'

const CURRENT = 'mot-de-passe-actuel'
const NEXT = 'NouveauMotDePasse1'

test.group('Compte — changement de mot de passe', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => clearLimits())

  async function makeMember(password: string | null): Promise<User> {
    const member: Member = await MemberFactory.create()
    const user = await User.findOrFail(member.id)
    // Affecté en clair : le `beforeSave` du mixin hache la colonne. C'est aussi
    // ce que fait le contrôleur, donc le test emprunte le même chemin.
    user.password = password
    await user.save()
    return user
  }

  function body(overrides: Record<string, string> = {}) {
    return {
      currentPassword: CURRENT,
      password: NEXT,
      passwordConfirmation: NEXT,
      ...overrides,
    }
  }

  /**
   * Chaque ligne échoue pour une raison **différente** — l'authentification pour
   * la première, une règle de mot de passe distincte pour chacune des suivantes.
   * Les corps se ressemblent, les défauts non : d'où une table étiquetée plutôt
   * que cinq tests jumeaux ou un seul test qui n'en couvrirait qu'un.
   */
  test('refuse un changement mal formé ou non authentifié par l’ancien mot de passe', async ({
    client,
    assert,
  }) => {
    const user = await makeMember(CURRENT)

    const cases: ReadonlyArray<
      [label: string, payload: ReturnType<typeof body>, status: number, code: string]
    > = [
      [
        'mauvais mot de passe actuel',
        body({ currentPassword: 'pas-le-bon' }),
        401,
        'E_INVALID_CREDENTIALS',
      ],
      [
        'confirmation discordante',
        body({ passwordConfirmation: `${NEXT}-autre` }),
        422,
        'E_VALIDATION_ERROR',
      ],
      [
        'trop court',
        body({ password: 'Court1', passwordConfirmation: 'Court1' }),
        422,
        'E_VALIDATION_ERROR',
      ],
      [
        'sans majuscule',
        body({ password: 'nouveaumotdepasse1', passwordConfirmation: 'nouveaumotdepasse1' }),
        422,
        'E_VALIDATION_ERROR',
      ],
      [
        'sans chiffre',
        body({ password: 'NouveauMotDePasse', passwordConfirmation: 'NouveauMotDePasse' }),
        422,
        'E_VALIDATION_ERROR',
      ],
    ]

    for (const [label, payload, status, code] of cases) {
      const response = await client.put('/v1/account/password').loginAs(user).json(payload)

      assert.equal(response.status(), status, label)
      assert.equal(errorCodeOf(response), code, label)
    }

    await user.refresh()
    const unchanged = await User.verifyPasswordCredentials(user.email, CURRENT)
    assert.equal(unchanged.id, user.id, 'aucun refus ne doit avoir écrit le nouveau mot de passe')
  })

  /**
   * Un compte né du SSO n'a rien à remplacer, et lui minter un mot de passe ici
   * ouvrirait un second chemin d'authentification — exactement ce que le
   * `hasPassword` du profil sert à ne pas raconter.
   */
  test('refuse un compte sans mot de passe', async ({ client, assert }) => {
    const user = await makeMember(null)

    const response = await client.put('/v1/account/password').loginAs(user).json(body())

    response.assertStatus(400)
    assert.equal(errorCodeOf(response), 'E_NO_PASSWORD_SET')
  })

  /**
   * Les deux moitiés comptent, et chacune est un défaut distinct : laisser vivre
   * les autres sessions annule le geste de changer son mot de passe après un vol,
   * et tuer la session courante jetterait l'utilisateur hors de la page où il
   * vient de réussir.
   */
  test('révoque les autres sessions et préserve la courante', async ({ client, assert }) => {
    const user = await makeMember(CURRENT)
    const current = await User.accessTokens.create(user)
    const other = await User.accessTokens.create(user)

    const response = await client
      .put('/v1/account/password')
      .bearerToken(current.value!.release())
      .json(body())

    response.assertStatus(204)

    const remaining = await User.accessTokens.all(user)
    const identifiers = remaining.map((token) => String(token.identifier))
    assert.include(identifiers, String(current.identifier), 'la session courante doit survivre')
    assert.notInclude(identifiers, String(other.identifier), 'les autres sessions doivent tomber')
  })

  /**
   * Prouve que l'écriture est passée par le `beforeSave` : une valeur déjà hachée
   * affectée à la colonne serait hachée une seconde fois, et le nouveau mot de
   * passe ne connecterait plus. Le refus de l'ancien est l'autre moitié — sans
   * lui, un test vert n'exclurait pas que les deux fonctionnent.
   */
  test('le nouveau mot de passe connecte, l’ancien ne connecte plus', async ({
    client,
    assert,
  }) => {
    const user = await makeMember(CURRENT)

    const change = await client.put('/v1/account/password').loginAs(user).json(body())
    change.assertStatus(204)

    const accepted = await client.post('/v1/auth/login').json({ email: user.email, password: NEXT })
    assert.equal(accepted.status(), 200, 'le nouveau mot de passe doit connecter')

    const refused = await client
      .post('/v1/auth/login')
      .json({ email: user.email, password: CURRENT })
    assert.equal(refused.status(), 401, 'l’ancien mot de passe ne doit plus connecter')
  })
})
