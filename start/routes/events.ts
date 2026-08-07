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

    /**
     * Running the matching rewrites every unlocked assignment of the evening,
     * so it is coordination work, not something any member may trigger.
     */
    router
      .post('/events/:id/matching', [controllers.Events, 'runMatching'])
      .use(middleware.can('event:matching'))

    /**
     * Closing an evening: consolidates the pending `points_delta` of its
     * assignments into `members.points`. Idempotent — a second call settles
     * nothing.
     *
     * Gated hardest of all: a settled evening makes `runMatching` fail with
     * 409, and the API offers no way back (only the `event:unsettle` ace
     * command does). Left open, one request from any member froze the evening
     * for good.
     */
    router
      .post('/events/:id/settle', [controllers.Events, 'settle'])
      .use(middleware.can('event:settle'))
  })
  .prefix('/v1')
  .use(middleware.auth())
