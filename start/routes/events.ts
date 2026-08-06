/*
|--------------------------------------------------------------------------
| Events routes
|--------------------------------------------------------------------------
|
| Events CRUD plus the per-event member response and roster endpoints.
|
*/

import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    /**
     * Events
     */
    router.get('/events', [controllers.Events, 'index'])
    router.post('/events', [controllers.Events, 'store'])
    router.get('/events/:id', [controllers.Events, 'show'])
    router.route('/events/:id', ['PUT', 'PATCH'], [controllers.Events, 'update'])
    router.delete('/events/:id', [controllers.Events, 'destroy'])

    /**
     * Per-event member response & roster
     */
    router.get('/events/:id/response', [controllers.Events, 'getResponse'])
    router.post('/events/:id/response', [controllers.Events, 'setResponse'])
    router.get('/events/:id/roster', [controllers.Events, 'roster'])
    router.post('/events/:id/matching', [controllers.Events, 'runMatching'])
  })
  .prefix('/v1')
  .use(middleware.auth())
