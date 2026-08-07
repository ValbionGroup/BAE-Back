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
     * Assignments — composite key, so `update` and `destroy` read the
     * `member_id` + `event_id` + `job_id` query params. `PUT` and `PATCH` share
     * one declaration: two separate ones derive the same route name and crash
     * the boot.
     *
     * The three writes are gated: each one moves credit (creating a row grants
     * up to +12, deleting a settled one takes it back), so they belong to the
     * coordination scope, not to every authenticated member. The listing stays
     * open — reading who holds what is what the roster screens do.
     */
    router.get('/assignments', [controllers.Assignments, 'index'])
    router
      .post('/assignments', [controllers.Assignments, 'store'])
      .use(middleware.can('assignment:write'))
    router
      .route('/assignments', ['PUT', 'PATCH'], [controllers.Assignments, 'update'])
      .use(middleware.can('assignment:write'))
    router
      .delete('/assignments', [controllers.Assignments, 'destroy'])
      .use(middleware.can('assignment:write'))

    /**
     * Global indexes
     */
    router.get('/responses', [controllers.Responses, 'index'])
    router.get('/preferences', [controllers.Preferences, 'index'])

    /**
     * Job eligible members — global (not per-event) restriction on which
     * members the matching algorithm may assign to a job. Composite key,
     * `destroy` reads the `job_id` + `member_id` query params.
     */
    router.get('/job-eligible-members', [controllers.JobEligibleMembers, 'index'])
    router.post('/job-eligible-members', [controllers.JobEligibleMembers, 'store'])
    router.delete('/job-eligible-members', [controllers.JobEligibleMembers, 'destroy'])
  })
  .prefix('/v1')
  .use(middleware.auth())

/*
| A member managing their OWN job ranking. Lives under the `v1/account` prefix
| next to `account/profile` and `account/sessions`: the caller is implied by the
| token, so no member id appears in the path and nobody can rank on behalf of
| someone else.
*/
router
  .group(() => {
    router.get('/preferences', [controllers.Preferences, 'mine'])
    router.route('/preferences', ['PUT', 'PATCH'], [controllers.Preferences, 'updateMine'])
  })
  .prefix('v1/account')
  .as('account_preferences')
  .use(middleware.auth())
