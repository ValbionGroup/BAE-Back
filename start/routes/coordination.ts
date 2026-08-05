/*
|--------------------------------------------------------------------------
| Coordination routes
|--------------------------------------------------------------------------
|
| Jobs, event jobs, assignments, member responses and job preferences.
|
| Note: `/responses` and `/preferences` are global read-only indexes over
| `member_responses` and `member_job_preferences`. They are given dedicated
| controllers to stay consistent with the one-resource-per-controller style
| used everywhere else in `app/controllers/`.
|
| /!\ Never declare `router.put(path, …)` and `router.patch(path, …)` as two
| separate calls for the same controller action — Adonis derives the route name
| from the controller action and crashes at boot on the duplicate name. Use
| `router.route(path, ['PUT', 'PATCH'], …)` instead.
|
*/

import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    /**
     * Jobs
     */
    router.get('/jobs', [controllers.Jobs, 'index'])
    router.post('/jobs', [controllers.Jobs, 'store'])
    router.get('/jobs/:id', [controllers.Jobs, 'show'])
    router.route('/jobs/:id', ['PUT', 'PATCH'], [controllers.Jobs, 'update'])
    router.delete('/jobs/:id', [controllers.Jobs, 'destroy'])

    /**
     * Event jobs — composite key, `update` and `destroy` read the
     * `event_id` + `job_id` query params instead of a route param.
     */
    router.get('/event-jobs', [controllers.EventJobs, 'index'])
    router.post('/event-jobs', [controllers.EventJobs, 'store'])
    router.route('/event-jobs', ['PUT', 'PATCH'], [controllers.EventJobs, 'update'])
    router.delete('/event-jobs', [controllers.EventJobs, 'destroy'])

    /**
     * Assignments — composite key, `destroy` reads the
     * `member_id` + `event_id` + `job_id` query params.
     */
    router.get('/assignments', [controllers.Assignments, 'index'])
    router.post('/assignments', [controllers.Assignments, 'store'])
    router.delete('/assignments', [controllers.Assignments, 'destroy'])

    /**
     * Global indexes
     */
    router.get('/responses', [controllers.Responses, 'index'])
    router.get('/preferences', [controllers.Preferences, 'index'])
  })
  .prefix('/v1')
  .use(middleware.auth())
