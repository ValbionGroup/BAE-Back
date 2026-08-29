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
      .get('/events/:id/sponsorship-categories', [controllers.SponsorshipCategories, 'index'])
      .use(middleware.can('menu:read'))
    router
      .post('/events/:id/sponsorship-categories', [controllers.SponsorshipCategories, 'store'])
      .use(middleware.can('menu:write'))
    router
      .patch('/events/:id/sponsorship-categories/:categoryId', [
        controllers.SponsorshipCategories,
        'update',
      ])
      .use(middleware.can('menu:write'))
    router
      .put('/events/:id/sponsorship-categories/:categoryId/prices', [
        controllers.SponsorshipCategories,
        'prices',
      ])
      .use(middleware.can('menu:write'))
    // Émettre un QR coûte aussi cher que modifier la grille : c'est un porteur de droit.
    router
      .get('/events/:id/sponsorship-categories/:categoryId/qr', [
        controllers.SponsorshipCategories,
        'qr',
      ])
      .use(middleware.can('menu:write'))
    router
      .post('/events/:id/sponsorship-categories/:categoryId/qr/rotate', [
        controllers.SponsorshipCategories,
        'rotate',
      ])
      .use(middleware.can('menu:write'))
    router
      .delete('/events/:id/sponsorship-categories/:categoryId', [
        controllers.SponsorshipCategories,
        'destroy',
      ])
      .use(middleware.can('menu:delete'))

    router
      .get('/events/:id/receivables', [controllers.SponsorshipCategories, 'receivables'])
      .use(middleware.can('order:read'))
    router
      .get('/events/:id/receivables/pdf', [controllers.SponsorshipCategories, 'receivablesPdf'])
      .use(middleware.can('order:read'))

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
      .post('/events/:id/card-payments', [controllers.CardPayments, 'store'])
      .use(middleware.can('order:write'))

    router
      .get('/events/:id/sellable', [controllers.Orders, 'sellable'])
      .use(middleware.can('order:read'))

    router
      .get('/events/:id/summary', [controllers.Orders, 'summary'])
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

    // `assignment:write` et non un droit neuf : qui compose l'affectation est
    // qui l'annonce. Une permission de plus se sèmerait à chaque déploiement
    // pour ne rien séparer de ce que ce droit couvre déjà.
    router
      .post('/events/:id/assignments/notify', [controllers.Events, 'notifyAssignments'])
      .use(middleware.can('assignment:write'))

    // Ouvrir relève de la préparation (`event:write`), clôturer de la
    // consolidation des points (`event:settle`) : deux gestes, deux droits.
    router.post('/events/:id/open', [controllers.Events, 'open']).use(middleware.can('event:write'))

    router
      .post('/events/:id/settle', [controllers.Events, 'settle'])
      .use(middleware.can('event:settle'))

    // job:read, comme /assignments (GET) : la même donnée, lue autrement, ne
    // change pas de droit.
    router
      .get('/events/:id/assignments/pdf', [controllers.Assignments, 'pdf'])
      .use(middleware.can('job:read'))
  })
  .prefix('/v1')
  .use([middleware.auth(), middleware.audience('member')])
