import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/jobs', [controllers.Jobs, 'index']).use(middleware.can('job:read'))
    router.post('/jobs', [controllers.Jobs, 'store']).use(middleware.can('job:write'))
    router.get('/jobs/:id', [controllers.Jobs, 'show']).use(middleware.can('job:read'))
    router
      .route('/jobs/:id', ['PUT', 'PATCH'], [controllers.Jobs, 'update'])
      .use(middleware.can('job:write'))
    router.delete('/jobs/:id', [controllers.Jobs, 'destroy']).use(middleware.can('job:delete'))

    router.get('/event-jobs', [controllers.EventJobs, 'index']).use(middleware.can('job:read'))
    router.post('/event-jobs', [controllers.EventJobs, 'store']).use(middleware.can('job:write'))
    router
      .route('/event-jobs', ['PUT', 'PATCH'], [controllers.EventJobs, 'update'])
      .use(middleware.can('job:write'))
    router
      .delete('/event-jobs', [controllers.EventJobs, 'destroy'])
      .use(middleware.can('job:delete'))

    router.get('/assignments', [controllers.Assignments, 'index'])
    router
      .post('/assignments', [controllers.Assignments, 'store'])
      .use(middleware.can('assignment:write'))
    router
      .route('/assignments', ['PUT', 'PATCH'], [controllers.Assignments, 'update'])
      .use(middleware.can('assignment:write'))
    router
      .delete('/assignments', [controllers.Assignments, 'destroy'])
      .use(middleware.can('assignment:delete'))

    router.get('/responses', [controllers.Responses, 'index']).use(middleware.can('job:read'))
    router.get('/preferences', [controllers.Preferences, 'index']).use(middleware.can('job:read'))

    router
      .get('/job-eligible-members', [controllers.JobEligibleMembers, 'index'])
      .use(middleware.can('job:read'))
    router
      .post('/job-eligible-members', [controllers.JobEligibleMembers, 'store'])
      .use(middleware.can('job:write'))
    router
      .delete('/job-eligible-members', [controllers.JobEligibleMembers, 'destroy'])
      .use(middleware.can('job:delete'))
  })
  .prefix('/v1')
  .use([middleware.auth(), middleware.audience('member')])

router
  .group(() => {
    router.get('/preferences', [controllers.Preferences, 'mine'])
    router.route('/preferences', ['PUT', 'PATCH'], [controllers.Preferences, 'updateMine'])
  })
  .prefix('v1/account')
  .as('account_preferences')
  .use([middleware.auth(), middleware.audience('member')])
