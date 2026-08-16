import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/logs', [controllers.Logs, 'index'])
    router.post('/logs', [controllers.Logs, 'store'])
    router.get('/logs/:id', [controllers.Logs, 'show'])
    router.route('/logs/:id', ['PUT', 'PATCH'], [controllers.Logs, 'update'])
    router.delete('/logs/:id', [controllers.Logs, 'destroy'])
  })
  .prefix('/v1')
  .use([middleware.auth(), middleware.audience('member'), middleware.can('log:read')])

router
  .group(() => {
    router.get('/sessions', [controllers.Sessions, 'index'])
    router.delete('/sessions/:id', [controllers.Sessions, 'destroy'])
  })
  .prefix('v1/account')
  .as('sessions')
  .use([middleware.auth(), middleware.audience('member')])
