import { test } from '@japa/runner'
import { backchannelUrl } from '#services/oidc_backchannel'

/**
 * Le problème que ces tests gardent : **une URL d'IdP sert deux consommateurs**.
 *
 * Les métadonnées OIDC portent `authorization_endpoint` — suivi par le
 * **navigateur** — et `token_endpoint` / `userinfo_endpoint` — appelés par le
 * **serveur**. Quand l'API tourne en conteneur ou derrière un réseau interne,
 * ces deux-là n'atteignent pas l'IdP par la même adresse.
 *
 * Confondre les deux donne une panne à retardement : la découverte réussit, la
 * redirection part, et c'est le navigateur qui échoue sur un nom d'hôte interne
 * qu'il ne résout pas.
 */
test.group('Adresse interne de l’IdP', () => {
  test('sans adresse interne, l’URL est rendue telle quelle', ({ assert }) => {
    const url = 'http://localhost:8080/realms/bae/protocol/openid-connect/token'

    assert.equal(backchannelUrl(url, undefined).href, url)
    assert.equal(backchannelUrl(url, '').href, url)
  })

  test('remplace l’origine, en gardant chemin et paramètres', ({ assert }) => {
    const rewritten = backchannelUrl(
      'http://localhost:8080/realms/bae/protocol/openid-connect/auth?scope=openid&state=abc',
      'http://host.docker.internal:8080'
    )

    assert.equal(rewritten.origin, 'http://host.docker.internal:8080')
    assert.equal(rewritten.pathname, '/realms/bae/protocol/openid-connect/auth')
    assert.equal(rewritten.searchParams.get('state'), 'abc')
  })

  test('accepte une adresse interne portant un chemin ou une barre finale', ({ assert }) => {
    for (const internal of [
      'http://keycloak:8080/',
      'http://keycloak:8080',
      'http://keycloak:8080/ignored',
    ]) {
      const rewritten = backchannelUrl('http://localhost:8080/realms/bae', internal)

      assert.equal(rewritten.href, 'http://keycloak:8080/realms/bae', `pour « ${internal} »`)
    }
  })

  test('change de schéma et de port quand l’adresse interne le demande', ({ assert }) => {
    const rewritten = backchannelUrl(
      'https://connect.eirb.fr/realms/eirb/protocol/openid-connect/token',
      'http://keycloak.internal:8080'
    )

    assert.equal(
      rewritten.href,
      'http://keycloak.internal:8080/realms/eirb/protocol/openid-connect/token'
    )
  })

  test('accepte aussi bien un objet URL qu’une chaîne', ({ assert }) => {
    const source = new URL('http://localhost:8080/realms/bae')

    assert.equal(backchannelUrl(source, 'http://keycloak:8080').host, 'keycloak:8080')
    // L'entrée ne doit pas être modifiée en place : `openid-client` la réutilise.
    assert.equal(source.host, 'localhost:8080')
  })
})
