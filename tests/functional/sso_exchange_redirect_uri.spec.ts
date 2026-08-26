import { test } from '@japa/runner'
import { createServer, type Server } from 'node:http'
import env from '#start/env'
import { exchange, resetConfigurationCache } from '#services/oidc_service'

const STUB_PORT = 8100
const STUB_ISSUER = `http://127.0.0.1:${STUB_PORT}/realms/stub`
const CALLBACK_URL = 'https://api.example.test/v1/auth/keycloak/callback'

let captured: URLSearchParams | null = null

/**
 * Un vrai serveur HTTP, et non un mock d'`openid-client` : c'est la bibliothèque
 * qui dérive le `redirect_uri`, donc seul ce qu'elle POSTe le prouve. Le point
 * de jeton répond une erreur — l'assertion porte sur ce qui a été envoyé.
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
          response_types_supported: ['code'],
        })
      )
      return
    }

    if (request.url === '/realms/stub/protocol/openid-connect/token') {
      let body = ''
      request.on('data', (chunk) => (body += chunk))
      request.on('end', () => {
        captured = new URLSearchParams(body)
        response.writeHead(400, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: 'invalid_grant' }))
      })
      return
    }

    response.writeHead(404).end()
  })

  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)))
}

test.group('SSO — le redirect_uri de l’échange', (group) => {
  const issuer = env.get('KEYCLOAK_ISSUER')
  const internal = env.get('KEYCLOAK_INTERNAL_URL')
  const callback = env.get('KEYCLOAK_CALLBACK_URL')
  let stub: Server | null = null

  group.each.setup(async () => {
    captured = null
    stub = await startStubIdp()
    env.set('KEYCLOAK_ISSUER', STUB_ISSUER)
    // ⚠️ Chaîne non vide : `env.set(…, undefined)` stocke la chaîne `'undefined'`,
    // truthy, et la réécriture serveur→IdP casserait avant de joindre le stub.
    env.set('KEYCLOAK_INTERNAL_URL', `http://127.0.0.1:${STUB_PORT}`)
    env.set('KEYCLOAK_CALLBACK_URL', CALLBACK_URL)
    resetConfigurationCache()

    return async () => {
      env.set('KEYCLOAK_ISSUER', issuer)
      env.set('KEYCLOAK_INTERNAL_URL', internal)
      env.set('KEYCLOAK_CALLBACK_URL', callback)
      resetConfigurationCache()
      await new Promise((resolve) => stub!.close(resolve))
      stub = null
    }
  })

  /**
   * ⚠️ L'URL entrante porte une origine **différente** de l'URI configurée :
   * c'est ce que `request.completeUrl()` produit derrière un proxy TLS que
   * `trustProxy` ne reconnaît pas.
   */
  test('vient de la configuration, jamais de la requête entrante', async ({ assert }) => {
    const state = 'un-state-de-test'

    await assert.rejects(() =>
      exchange(
        new URL(`http://127.0.0.1:3333/v1/auth/keycloak/callback?state=${state}&code=un-code`),
        { state, codeVerifier: 'x'.repeat(43) }
      )
    )

    assert.isNotNull(captured, 'le point de jeton doit avoir été appelé')
    assert.equal(
      captured!.get('redirect_uri'),
      CALLBACK_URL,
      'l’IdP a mémorisé cette URI avec le code : elle doit être renvoyée à l’identique'
    )
  })
})
