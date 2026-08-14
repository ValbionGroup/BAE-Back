import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/fast-passes', [controllers.FastPasses, 'index'])
    router.post('/fast-passes', [controllers.FastPasses, 'store'])
    router.get('/fast-passes/:id', [controllers.FastPasses, 'show'])
    router.put('/fast-passes/:id', [controllers.FastPasses, 'update'])
    router.delete('/fast-passes/:id', [controllers.FastPasses, 'destroy'])

    router.get('/transactions', [controllers.Transactions, 'index'])

    router.get('/vouchers', [controllers.Vouchers, 'index']).use(middleware.can('voucher:read'))
    router.post('/vouchers', [controllers.Vouchers, 'store']).use(middleware.can('voucher:write'))
    router
      .route('/vouchers/:id', ['PUT', 'PATCH'], [controllers.Vouchers, 'update'])
      .use(middleware.can('voucher:write'))
    router
      .delete('/vouchers/:id', [controllers.Vouchers, 'destroy'])
      .use(middleware.can('voucher:write'))
  })
  .prefix('/v1')
  .use(middleware.auth())
