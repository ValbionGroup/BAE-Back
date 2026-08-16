import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.post('signup', [controllers.NewAccount, 'store'])
    router.post('login', [controllers.AccessToken, 'store'])
    router.post('logout', [controllers.AccessToken, 'destroy']).use(middleware.auth())
    router.delete('logout-all', [controllers.AccessToken, 'destroyAll']).use(middleware.auth())

    // Hors `middleware.auth()` : c'est la porte d'entrée, l'utilisateur n'est pas
    // encore authentifié. **Une seule URI de callback**, parce que chacune doit
    // être whitelistée par EirbWare — la zone visée voyage dans la session, à
    // côté du `state`, et jamais dans l'URL de retour.
    router.get('keycloak/redirect', [controllers.KeycloakAuth, 'redirect'])
    router.get('keycloak/callback', [controllers.KeycloakAuth, 'callback'])
  })
  .prefix('v1/auth')
  .as('auth')

router
  .group(() => {
    router.get('/profile', [controllers.Profile, 'show'])
    router.get('/qr', [controllers.Qrs, 'mine'])
  })
  .prefix('v1/account')
  .as('profile')
  .use(middleware.auth())
