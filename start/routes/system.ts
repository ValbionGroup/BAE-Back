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

// Sous `/account` et sans garde d'audience : ce sont **ses** notifications, et un
// client en aura tout autant qu'un membre (précommande prête, cotisation qui
// expire). Le filtre de sécurité est le `where user_id` du contrôleur, pas une
// permission — aucune permission ne dirait « les siennes ».
router
  .group(() => {
    router.get('/notifications', [controllers.Notifications, 'index'])
    router.patch('/notifications/:id/read', [controllers.Notifications, 'markRead'])
    router.post('/notifications/read-all', [controllers.Notifications, 'markAllRead'])
  })
  .prefix('v1/account')
  .as('notifications')
  .use(middleware.auth())
