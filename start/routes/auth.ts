import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

router
  .group(() => {
    router.post('signup', [controllers.NewAccount, 'store'])
    router.post('login', [controllers.AccessToken, 'store']).use(throttle.login)
    router.post('logout', [controllers.AccessToken, 'destroy']).use(middleware.auth())
    router.delete('logout-all', [controllers.AccessToken, 'destroyAll']).use(middleware.auth())

    router
      .post('password/forgot', [controllers.PasswordReset, 'request'])
      .use(throttle.passwordForgot)
    router.post('password/reset', [controllers.PasswordReset, 'reset']).use(throttle.passwordReset)

    router.get('2fa/challenge', [controllers.TwoFactor, 'challenge'])
    router.post('2fa/verify', [controllers.TwoFactor, 'verify'])

    router.get('keycloak/redirect', [controllers.KeycloakAuth, 'redirect'])
    router.get('keycloak/callback', [controllers.KeycloakAuth, 'callback'])
    router.get('keycloak/logout', [controllers.KeycloakAuth, 'logout']).use(middleware.auth())
  })
  .prefix('v1/auth')
  .as('auth')

router
  .group(() => {
    router.get('/profile', [controllers.Profile, 'show'])
    router.get('/qr', [controllers.Qrs, 'mine'])
    router.patch('/profile', [controllers.Profile, 'update']).use(middleware.audience('client'))
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
    router.post('/2fa', [controllers.TwoFactor, 'store'])
    router.post('/2fa/confirm', [controllers.TwoFactor, 'confirm'])
    router.post('/2fa/recovery-codes', [controllers.TwoFactor, 'recoveryCodes'])
    router.post('/2fa/disable', [controllers.TwoFactor, 'disable'])
  })
  .prefix('v1/account')
  .as('accountSecurity')
  .use([middleware.auth(), middleware.audience('member'), throttle.accountSecurity])
