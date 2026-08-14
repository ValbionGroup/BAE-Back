import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router
      .get('/fast-passes', [controllers.FastPasses, 'index'])
      .use(middleware.can('fast-pass:read'))
    router
      .post('/fast-passes', [controllers.FastPasses, 'store'])
      .use(middleware.can('fast-pass:write'))
    router
      .get('/fast-passes/:id', [controllers.FastPasses, 'show'])
      .use(middleware.can('fast-pass:read'))
    router
      .put('/fast-passes/:id', [controllers.FastPasses, 'update'])
      .use(middleware.can('fast-pass:write'))
    router
      .delete('/fast-passes/:id', [controllers.FastPasses, 'destroy'])
      .use(middleware.can('fast-pass:delete'))

    router
      .get('/transactions', [controllers.Transactions, 'index'])
      .use(middleware.can('transaction:read'))

    router.get('/vouchers', [controllers.Vouchers, 'index']).use(middleware.can('voucher:read'))
    router.post('/vouchers', [controllers.Vouchers, 'store']).use(middleware.can('voucher:write'))
    router
      .route('/vouchers/:id', ['PUT', 'PATCH'], [controllers.Vouchers, 'update'])
      .use(middleware.can('voucher:write'))
    router
      .delete('/vouchers/:id', [controllers.Vouchers, 'destroy'])
      .use(middleware.can('voucher:delete'))
  })
  .prefix('/v1')
  .use(middleware.auth())
