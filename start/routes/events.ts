import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/events', [controllers.Events, 'index']).use(middleware.can('event:read'))
    router.post('/events', [controllers.Events, 'store']).use(middleware.can('event:write'))
    router.get('/events/:id', [controllers.Events, 'show']).use(middleware.can('event:read'))
    router
      .route('/events/:id', ['PUT', 'PATCH'], [controllers.Events, 'update'])
      .use(middleware.can('event:write'))
    router
      .delete('/events/:id', [controllers.Events, 'destroy'])
      .use(middleware.can('event:delete'))

    router
      .get('/events/:id/response', [controllers.Events, 'getResponse'])
      .use(middleware.can('presence:read'))
    router
      .post('/events/:id/response', [controllers.Events, 'setResponse'])
      .use(middleware.can('presence:write'))
    router
      .get('/events/:id/roster', [controllers.Events, 'roster'])
      .use(middleware.can('event:read'))

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
      .use(middleware.can('menu:delete'))

    router
      .get('/events/:id/shopping-list', [controllers.EventProducts, 'shoppingList'])
      .use(middleware.can(['menu:read', 'stock:read']))

    router
      .get('/events/:id/shopping-list/pdf', [controllers.EventProducts, 'shoppingListPdf'])
      .use(middleware.can(['menu:read', 'stock:read']))

    router
      .get('/events/:id/orders', [controllers.Orders, 'index'])
      .use(middleware.can('order:read'))

    router
      .post('/events/:id/orders', [controllers.Orders, 'store'])
      .use(middleware.can('order:write'))

    router
      .get('/events/:id/sellable', [controllers.Orders, 'sellable'])
      .use(middleware.can('order:read'))

    router
      .get('/events/:id/pre-orders', [controllers.PreOrders, 'index'])
      .use(middleware.can('order:read'))

    router
      .get('/events/:id/production-runs', [controllers.ProductionRuns, 'index'])
      .use(middleware.can('stock:read'))

    router
      .post('/events/:id/production-runs', [controllers.ProductionRuns, 'store'])
      .use(middleware.can('stock:write'))

    router
      .get('/events/:id/production-plan/pdf', [controllers.ProductionRuns, 'productionPlanPdf'])
      .use(middleware.can('stock:read'))

    router
      .get('/events/:id/production-returns', [controllers.ProductionRuns, 'returnState'])
      .use(middleware.can('stock:read'))

    router
      .post('/events/:id/production-returns', [controllers.ProductionRuns, 'returns'])
      .use(middleware.can('stock:write'))

    router
      .get('/events/:id/production-returns/pdf', [
        controllers.ProductionRuns,
        'productionReturnsPdf',
      ])
      .use(middleware.can('stock:read'))

    router
      .post('/events/:id/matching', [controllers.Events, 'runMatching'])
      .use(middleware.can('event:matching'))

    router
      .post('/events/:id/settle', [controllers.Events, 'settle'])
      .use(middleware.can('event:settle'))

    // job:read explicite : contrairement à /assignments (GET), qui n'en porte
    // aucune, ce trou n'est pas reproduit sur la route PDF.
    router
      .get('/events/:id/assignments/pdf', [controllers.Assignments, 'pdf'])
      .use(middleware.can('job:read'))
  })
  .prefix('/v1')
  .use(middleware.auth())
