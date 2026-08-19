import { test } from '@japa/runner'
import env from '#start/env'
import { resetConfigurationCache } from '#services/oidc_service'

/**
 * `redirect()` est atteint par une **navigation de premier niveau** : ce que le
 * navigateur reçoit s'affiche. Laisser remonter l'exception y met du JSON brut,
 * sur le domaine de l'API — l'utilisateur voit « fetch failed » et n'a aucun
 * chemin de retour. `callback()` soigne déjà ses sorties d'erreur ; celle-ci doit
 * suivre la même règle.
 */
test.group('SSO — IdP injoignable', (group) => {
  const issuer = env.get('KEYCLOAK_ISSUER')

  group.each.setup(() => {
    // Un port fermé sur une adresse non routable : la découverte échoue vite,
    // sans dépendre de la présence d'un Keycloak local.
    env.set('KEYCLOAK_ISSUER', 'http://127.0.0.1:1/realms/bae')
    // ⚠️ Chaîne vide et non `undefined` : `env.set` stockerait la chaîne
    // `'undefined'`, truthy, et la découverte échouerait sur une URL invalide
    // au lieu du port fermé que ce test vise. Le test passait quand même — pour
    // la mauvaise raison.
    env.set('KEYCLOAK_INTERNAL_URL', '')
    resetConfigurationCache()

    return () => {
      env.set('KEYCLOAK_ISSUER', issuer)
      resetConfigurationCache()
    }
  })

  test('renvoie le visiteur sur le login du front public, pas sur du JSON', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/v1/auth/keycloak/redirect?app=public').redirects(0)

    response.assertStatus(302)
    const location = response.header('location') as string
    assert.include(location, env.get('PUBLIC_APP_URL'))
    assert.include(location, 'sso_error=idp_unavailable')
  })

  test('renvoie sur le dashboard quand la zone est le dashboard', async ({ client, assert }) => {
    const response = await client.get('/v1/auth/keycloak/redirect?app=dashboard').redirects(0)

    response.assertStatus(302)
    assert.include(response.header('location') as string, env.get('DASHBOARD_URL'))
  })
})
