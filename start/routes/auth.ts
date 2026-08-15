import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.post('signup', [controllers.NewAccount, 'store'])
    router.post('login', [controllers.AccessToken, 'store'])
    router.post('logout', [controllers.AccessToken, 'destroy']).use(middleware.auth())
    router.delete('logout-all', [controllers.AccessToken, 'destroyAll']).use(middleware.auth())
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
