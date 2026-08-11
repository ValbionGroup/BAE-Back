import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/events', [controllers.Events, 'index'])
    router.post('/events', [controllers.Events, 'store'])
    router.get('/events/:id', [controllers.Events, 'show'])
    router.route('/events/:id', ['PUT', 'PATCH'], [controllers.Events, 'update'])
    router.delete('/events/:id', [controllers.Events, 'destroy'])

    router.get('/events/:id/response', [controllers.Events, 'getResponse'])
    router.post('/events/:id/response', [controllers.Events, 'setResponse'])
    router.get('/events/:id/roster', [controllers.Events, 'roster'])

    router
      .get('/events/:id/products', [controllers.EventProducts, 'index'])
      .use(middleware.can('menu:read'))
    router
      .post('/events/:id/products', [controllers.EventProducts, 'store'])
      .use(middleware.can('menu:write'))
    router
      .patch('/events/:id/products/:productId', [controllers.EventProducts, 'update'])
      .use(middleware.can('menu:write'))
    router
      .delete('/events/:id/products/:productId', [controllers.EventProducts, 'destroy'])
      .use(middleware.can('menu:write'))

    router
      .get('/events/:id/shopping-list', [controllers.EventProducts, 'shoppingList'])
      .use(middleware.can(['menu:read', 'stock:read']))

    router
      .get('/events/:id/production-runs', [controllers.ProductionRuns, 'index'])
      .use(middleware.can('stock:read'))

    router
      .post('/events/:id/production-runs', [controllers.ProductionRuns, 'store'])
      .use(middleware.can('stock:update'))

    router
      .post('/events/:id/matching', [controllers.Events, 'runMatching'])
      .use(middleware.can('event:matching'))

    router
      .post('/events/:id/settle', [controllers.Events, 'settle'])
      .use(middleware.can('event:settle'))
  })
  .prefix('/v1')
  .use(middleware.auth())
