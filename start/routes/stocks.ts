import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/stocks', [controllers.Stocks, 'index'])
    router.get('/stocks/:id/batches', [controllers.Stocks, 'batches'])
    router.post('/stocks/:id/batches/:batchId/discard', [controllers.Stocks, 'discard'])

    router.get('/stock-batches', [controllers.StockBatches, 'index'])
    router.post('/stock-batches', [controllers.StockBatches, 'store'])
    router.get('/stock-batches/:id', [controllers.StockBatches, 'show'])
    router.route('/stock-batches/:id', ['PUT', 'PATCH'], [controllers.StockBatches, 'update'])
    router.delete('/stock-batches/:id', [controllers.StockBatches, 'destroy'])

    router.get('/stock-movements', [controllers.StockMovements, 'index'])
    router.post('/stock-movements', [controllers.StockMovements, 'store'])
    router.get('/stock-movements/:id', [controllers.StockMovements, 'show'])
    router.route('/stock-movements/:id', ['PUT', 'PATCH'], [controllers.StockMovements, 'update'])
    router.delete('/stock-movements/:id', [controllers.StockMovements, 'destroy'])

    router.get('/restocks', [controllers.Restocks, 'index'])
    router.post('/restocks', [controllers.Restocks, 'store'])
    router.get('/restocks/:id', [controllers.Restocks, 'show'])
    router.route('/restocks/:id', ['PUT', 'PATCH'], [controllers.Restocks, 'update'])
    router.delete('/restocks/:id', [controllers.Restocks, 'destroy'])
  })
  .prefix('/v1')
  .use(middleware.auth())
