import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/stocks', [controllers.Stocks, 'index']).use(middleware.can('stock:read'))
    router
      .get('/stocks/:id/batches', [controllers.Stocks, 'batches'])
      .use(middleware.can('stock:read'))
    router
      .post('/stocks/:id/batches/:batchId/discard', [controllers.Stocks, 'discard'])
      .use(middleware.can('stock:write'))

    router
      .get('/stock-batches', [controllers.StockBatches, 'index'])
      .use(middleware.can('stock:read'))
    router
      .post('/stock-batches', [controllers.StockBatches, 'store'])
      .use(middleware.can('stock:write'))

    // Déclarées AVANT /stock-batches/:id : sinon "inventory"/"labels" seraient
    // avalés comme un :id.
    router
      .get('/stock-batches/inventory/pdf', [controllers.StockBatches, 'inventoryPdf'])
      .use(middleware.can('stock:read'))
    router
      .get('/stock-batches/labels/pdf', [controllers.StockBatches, 'labelsPdf'])
      .use(middleware.can('stock:read'))

    router
      .get('/stock-batches/:id', [controllers.StockBatches, 'show'])
      .use(middleware.can('stock:read'))
    router
      .route('/stock-batches/:id', ['PUT', 'PATCH'], [controllers.StockBatches, 'update'])
      .use(middleware.can('stock:write'))
    router
      .delete('/stock-batches/:id', [controllers.StockBatches, 'destroy'])
      .use(middleware.can('stock:delete'))

    router
      .get('/stock-movements', [controllers.StockMovements, 'index'])
      .use(middleware.can('stock:read'))
    router
      .post('/stock-movements', [controllers.StockMovements, 'store'])
      .use(middleware.can('stock:write'))
    router
      .get('/stock-movements/:id', [controllers.StockMovements, 'show'])
      .use(middleware.can('stock:read'))
    router
      .route('/stock-movements/:id', ['PUT', 'PATCH'], [controllers.StockMovements, 'update'])
      .use(middleware.can('stock:write'))
    router
      .delete('/stock-movements/:id', [controllers.StockMovements, 'destroy'])
      .use(middleware.can('stock:delete'))

    router.get('/restocks', [controllers.Restocks, 'index']).use(middleware.can('restock:read'))
    router.post('/restocks', [controllers.Restocks, 'store']).use(middleware.can('restock:write'))
    router.get('/restocks/:id', [controllers.Restocks, 'show']).use(middleware.can('restock:read'))
    router
      .route('/restocks/:id', ['PUT', 'PATCH'], [controllers.Restocks, 'update'])
      .use(middleware.can('restock:write'))
    router
      .delete('/restocks/:id', [controllers.Restocks, 'destroy'])
      .use(middleware.can('restock:delete'))
  })
  .prefix('/v1')
  .use([middleware.auth(), middleware.audience('member')])
