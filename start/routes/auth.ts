import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.post('signup', [controllers.NewAccount, 'store'])
    router.post('login', [controllers.AccessToken, 'store'])
    router.post('logout', [controllers.AccessToken, 'destroy']).use(middleware.auth())
    router.delete('logout-all', [controllers.AccessToken, 'destroyAll']).use(middleware.auth())

    // Anonymes, donc exemptées de CSRF par le prédicat de `config/shield.ts`.
    router.post('password/forgot', [controllers.PasswordReset, 'request'])
    router.post('password/reset', [controllers.PasswordReset, 'reset'])

    // Hors `middleware.auth()` : c'est la porte d'entrée, l'utilisateur n'est pas
    // encore authentifié. **Une seule URI de callback**, parce que chacune doit
    // être whitelistée par EirbWare — la zone visée voyage dans la session, à
    // côté du `state`, et jamais dans l'URL de retour.
    router.get('keycloak/redirect', [controllers.KeycloakAuth, 'redirect'])
    router.get('keycloak/callback', [controllers.KeycloakAuth, 'callback'])

    // ⚠️ GET et authentifiée : c'est une **navigation**, le navigateur doit
    // suivre la redirection vers l'IdP. Un POST serait refusé par le CSRF dès
    // lors que la session n'est portée que par le cookie.
    router.get('keycloak/logout', [controllers.KeycloakAuth, 'logout']).use(middleware.auth())
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

/**
 * Un **second** groupe sur le même préfixe, et non deux routes de plus dans celui
 * du dessus.
 *
 * ⚠️ La raison est la seule chose importante de ce fichier : `audience('member')`
 * posé sur le groupe précédent casserait la zone publique en silence. `/profile` et
 * `/qr` sont l'ossature de l'application client — un adhérent sans ligne dans
 * `members` doit continuer à lire son profil et afficher son QR.
 *
 * Ici, à l'inverse, l'appartenance est la règle : définir une 2FA ou changer son
 * mot de passe est réservé aux membres du bureau.
 */
router
  .group(() => {
    router.put('/password', [controllers.AccountPassword, 'update'])
  })
  .prefix('v1/account')
  .as('accountSecurity')
  .use([middleware.auth(), middleware.audience('member')])
