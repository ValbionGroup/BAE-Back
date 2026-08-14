/*
|--------------------------------------------------------------------------
| System routes
|--------------------------------------------------------------------------
|
| Application logs and account sessions (active access tokens).
|
*/

import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

/*
| Logs record every request, including who made it and (for non-auth routes)
| the response body. That is an audit trail, not general-purpose data, so it
| is gated behind `log:read` rather than plain authentication — which is what
| let any member read it before.
*/
router
  .group(() => {
    router.get('/logs', [controllers.Logs, 'index'])
    router.post('/logs', [controllers.Logs, 'store'])
    router.get('/logs/:id', [controllers.Logs, 'show'])
    router.route('/logs/:id', ['PUT', 'PATCH'], [controllers.Logs, 'update'])
    router.delete('/logs/:id', [controllers.Logs, 'destroy'])
  })
  .prefix('/v1')
  .use([middleware.auth(), middleware.can('log:read')])

/*
| Account sessions live under the `v1/account` prefix, next to
| `v1/account/profile` declared in `start/routes/auth.ts`.
*/
router
  .group(() => {
    router.get('/sessions', [controllers.Sessions, 'index'])
    router.delete('/sessions/:id', [controllers.Sessions, 'destroy'])
  })
  .prefix('v1/account')
  .as('sessions')
  .use(middleware.auth())
