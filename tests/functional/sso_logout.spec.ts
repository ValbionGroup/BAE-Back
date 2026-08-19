import { test } from '@japa/runner'
import { createServer, type Server } from 'node:http'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import env from '#start/env'
import User from '#models/user'
import { MemberFactory } from '#database/factories/members_factory'
import { grantPermissions } from '#tests/helpers/permissions'
import { resetConfigurationCache } from '#services/oidc_service'
import { SESSION_COOKIE } from '#services/session_cookie'

const STUB_PORT = 8099
const STUB_ISSUER = `http://127.0.0.1:${STUB_PORT}/realms/stub`
const STUB_END_SESSION = `${STUB_ISSUER}/protocol/openid-connect/logout`

/**
 * Un vrai serveur HTTP, et non un mock d'`openid-client` : ce qu'on veut éprouver
 * est justement la construction de l'URL par la bibliothèque, à partir de
 * métadonnées découvertes. Un mock la court-circuiterait et ne prouverait rien.
 */
function startStubIdp(): Promise<Server> {
  const server = createServer((request, response) => {
    if (request.url === '/realms/stub/.well-known/openid-configuration') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          issuer: STUB_ISSUER,
          authorization_endpoint: `${STUB_ISSUER}/protocol/openid-connect/auth`,
          token_endpoint: `${STUB_ISSUER}/protocol/openid-connect/token`,
          jwks_uri: `${STUB_ISSUER}/protocol/openid-connect/certs`,
          end_session_endpoint: STUB_END_SESSION,
          response_types_supported: ['code'],
        })
      )
      return
    }

    response.writeHead(404).end()
  })

  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)))
}

/** Crée une connexion réelle et rend le jeton en clair + l'identifiant de sa ligne. */
async function login(ssoIdToken: string | null) {
  const member = await MemberFactory.create()
  const user = await grantPermissions(member, ['member:read'])
  const token = await User.accessTokens.create(user)

  if (ssoIdToken !== null) {
    await db
      .from('auth_access_tokens')
      .where('id', Number(token.identifier))
      .update({ sso_id_token: ssoIdToken })
  }

  return { user, value: token.value!.release() }
}

async function tokenCount(user: User): Promise<number> {
  const tokens = await User.accessTokens.all(user)
  return tokens.length
}

test.group('SSO — déconnexion globale', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const issuer = env.get('KEYCLOAK_ISSUER')
  const internal = env.get('KEYCLOAK_INTERNAL_URL')
  let stub: Server | null = null

  group.each.setup(async () => {
    stub = await startStubIdp()
    env.set('KEYCLOAK_ISSUER', STUB_ISSUER)
    // ⚠️ Pointée sur le stub, et **non** mise à `undefined` : `env.set` stocke
    // alors la chaîne `'undefined'`, qui est truthy — la réécriture
    // serveur→IdP tenterait `new URL('undefined')` et la découverte casserait
    // avant d'avoir joint quoi que ce soit.
    env.set('KEYCLOAK_INTERNAL_URL', `http://127.0.0.1:${STUB_PORT}`)
    resetConfigurationCache()

    return async () => {
      env.set('KEYCLOAK_ISSUER', issuer)
      env.set('KEYCLOAK_INTERNAL_URL', internal)
      resetConfigurationCache()
      await new Promise((resolve) => stub!.close(resolve))
      stub = null
    }
  })

  test('renvoie vers l’IdP avec l’id_token_hint et la redirection de retour', async ({
    client,
    assert,
  }) => {
    const { value } = await login('un-id-token-signe')

    const response = await client
      .get('/v1/auth/keycloak/logout?app=dashboard')
      .header('Authorization', `Bearer ${value}`)
      .redirects(0)

    response.assertStatus(302)
    const location = new URL(response.header('location') as string)
    assert.equal(`${location.origin}${location.pathname}`, STUB_END_SESSION)
    assert.equal(location.searchParams.get('id_token_hint'), 'un-id-token-signe')
    assert.equal(
      location.searchParams.get('post_logout_redirect_uri'),
      env.get('DASHBOARD_URL'),
      'la destination se résout côté serveur, jamais depuis le client'
    )
  })

  test('la zone publique repart vers le front public', async ({ client, assert }) => {
    const { value } = await login('un-id-token-signe')

    const response = await client
      .get('/v1/auth/keycloak/logout?app=public')
      .header('Authorization', `Bearer ${value}`)
      .redirects(0)

    const location = new URL(response.header('location') as string)
    assert.equal(location.searchParams.get('post_logout_redirect_uri'), env.get('PUBLIC_APP_URL'))
  })

  /**
   * ⚠️ Le cas **nominal** du dashboard : un compte authentifié par mot de passe
   * n'a jamais d'`id_token`. Ce n'est pas une erreur, et ça ne doit pas empêcher
   * la déconnexion.
   */
  test('sans id_token, la déconnexion reste locale et aboutit', async ({ client, assert }) => {
    const { user, value } = await login(null)

    const response = await client
      .get('/v1/auth/keycloak/logout?app=dashboard')
      .header('Authorization', `Bearer ${value}`)
      .redirects(0)

    response.assertStatus(302)
    assert.equal(response.header('location'), env.get('DASHBOARD_URL'))
    assert.equal(await tokenCount(user), 0, 'la session locale doit être révoquée')
  })

  test('révoque la session locale et efface le cookie avant de partir', async ({
    client,
    assert,
  }) => {
    const { user, value } = await login('un-id-token-signe')

    const response = await client
      .get('/v1/auth/keycloak/logout?app=dashboard')
      .header('Authorization', `Bearer ${value}`)
      .redirects(0)

    assert.equal(await tokenCount(user), 0)
    const cookie = response.cookie(SESSION_COOKIE)
    assert.isDefined(cookie, 'le cookie doit être effacé même quand on part vers l’IdP')
    assert.equal(cookie!.value, '')
  })

  /**
   * ⚠️ Même contrat que `redirect()` : le client n'envoie qu'un mot-clé d'une
   * liste fermée. Une URL acceptée telle quelle serait une redirection ouverte.
   */
  test('refuse une zone inconnue', async ({ client }) => {
    const { value } = await login(null)

    const response = await client
      .get('/v1/auth/keycloak/logout?app=https://ailleurs.example')
      .header('Authorization', `Bearer ${value}`)
      .redirects(0)

    response.assertStatus(400)
  })

  test('un IdP injoignable n’empêche pas la déconnexion locale', async ({ client, assert }) => {
    env.set('KEYCLOAK_ISSUER', 'http://127.0.0.1:1/realms/bae')
    resetConfigurationCache()

    const { user, value } = await login('un-id-token-signe')

    const response = await client
      .get('/v1/auth/keycloak/logout?app=dashboard')
      .header('Authorization', `Bearer ${value}`)
      .redirects(0)

    response.assertStatus(302)
    assert.equal(response.header('location'), env.get('DASHBOARD_URL'))
    assert.equal(await tokenCount(user), 0, 'l’IdP ne doit pas pouvoir retenir la session locale')
  })
})
