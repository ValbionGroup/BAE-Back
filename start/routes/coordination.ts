import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/jobs', [controllers.Jobs, 'index'])
    router.post('/jobs', [controllers.Jobs, 'store'])
    router.get('/jobs/:id', [controllers.Jobs, 'show'])
    router.route('/jobs/:id', ['PUT', 'PATCH'], [controllers.Jobs, 'update'])
    router.delete('/jobs/:id', [controllers.Jobs, 'destroy'])

    router.get('/event-jobs', [controllers.EventJobs, 'index'])
    router.post('/event-jobs', [controllers.EventJobs, 'store'])
    router.route('/event-jobs', ['PUT', 'PATCH'], [controllers.EventJobs, 'update'])
    router.delete('/event-jobs', [controllers.EventJobs, 'destroy'])

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

    router.get('/responses', [controllers.Responses, 'index'])
    router.get('/preferences', [controllers.Preferences, 'index'])

    router.get('/job-eligible-members', [controllers.JobEligibleMembers, 'index'])
    router.post('/job-eligible-members', [controllers.JobEligibleMembers, 'store'])
    router.delete('/job-eligible-members', [controllers.JobEligibleMembers, 'destroy'])
  })
  .prefix('/v1')
  .use(middleware.auth())

router
  .group(() => {
    router.get('/preferences', [controllers.Preferences, 'mine'])
    router.route('/preferences', ['PUT', 'PATCH'], [controllers.Preferences, 'updateMine'])
  })
  .prefix('v1/account')
  .as('account_preferences')
  .use(middleware.auth())
