import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/logs', [controllers.Logs, 'index']).use(middleware.can('log:read'))
    router.get('/logs/:id', [controllers.Logs, 'show']).use(middleware.can('log:read'))
    router.delete('/logs/:id', [controllers.Logs, 'destroy']).use(middleware.can('log:delete'))
  })
  .prefix('/v1')
  .use([middleware.auth(), middleware.audience('member')])

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

// Ouvrir un ticket et suivre les siens n'exige **aucune permission** : c'est une
// question de propriété. `ticket:read` élargit la vue à tous les tickets,
// `ticket:write` autorise à en changer le statut — le rôle du support.
router
  .group(() => {
    router.get('/tickets', [controllers.Tickets, 'index'])
    router.post('/tickets', [controllers.Tickets, 'store'])
    router.get('/tickets/:id', [controllers.Tickets, 'show'])
    router.post('/tickets/:id/messages', [controllers.Tickets, 'reply'])
    router
      .patch('/tickets/:id/status', [controllers.Tickets, 'setStatus'])
      .use(middleware.can('ticket:write'))
  })
  .prefix('/v1')
  .as('tickets')
  .use(middleware.auth())

// Le fil d'activité de l'équipe. Aucune permission dédiée : c'est le panneau de
// l'accueil, visible par tout membre — le contrôle d'accès est l'appartenance.
router
  .group(() => {
    router.get('/activity', [controllers.Activity, 'index'])
  })
  .prefix('/v1')
  .as('activity')
  .use([middleware.auth(), middleware.audience('member')])
