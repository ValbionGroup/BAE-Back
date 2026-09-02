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

    router
      .get('/analytics/season', [controllers.Analytics, 'season'])
      .use(middleware.can('transaction:read'))

    router.get('/payments', [controllers.Payments, 'index']).use(middleware.can('payment:read'))

    router
      .get('/card-payments/:orderRef', [controllers.CardPayments, 'show'])
      .use(middleware.can('order:write'))
    router
      .post('/card-payments/:orderRef/refresh', [controllers.CardPayments, 'refresh'])
      .use(middleware.can('order:write'))
    router
      .post('/card-payments/:orderRef/cancel', [controllers.CardPayments, 'destroy'])
      .use(middleware.can('order:write'))

    router
      .get('/clients/summary', [controllers.Clients, 'summary'])
      .use(middleware.can('client:read'))
    router.get('/clients', [controllers.Clients, 'index']).use(middleware.can('client:read'))
    router.get('/clients/:id', [controllers.Clients, 'show']).use(middleware.can('client:read'))
    router
      .route('/clients/:id', ['PUT', 'PATCH'], [controllers.Clients, 'update'])
      .use(middleware.can('client:write'))
    router
      .delete('/clients/:id', [controllers.Clients, 'destroy'])
      .use(middleware.can('client:delete'))

    router
      .post('/subscriptions', [controllers.Subscriptions, 'store'])
      .use(middleware.can('subscription:write'))
    router
      .delete('/subscriptions/:userId/:fastPassId', [controllers.Subscriptions, 'destroy'])
      .use(middleware.can('subscription:delete'))

    router.post('/qr/verify', [controllers.Qrs, 'verify']).use(middleware.can('order:write'))
    router.get('/buyers', [controllers.Qrs, 'search']).use(middleware.can('order:write'))

    router
      .patch('/orders/:id/status', [controllers.Orders, 'setStatus'])
      .use(middleware.can('order:serve'))

    router
      .delete('/orders/:id', [controllers.Orders, 'destroy'])
      .use(middleware.can('order:delete'))

    router
      .patch('/pre-orders/:id/status', [controllers.PreOrders, 'setStatus'])
      .use(middleware.can('order:write'))

    router
      .patch('/pre-orders/:id/pickup', [controllers.PreOrders, 'setPickup'])
      .use(middleware.can('order:write'))

    router
      .post('/pre-orders/:id/collect', [controllers.PreOrders, 'collect'])
      .use(middleware.can('order:write'))

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
  .use([middleware.auth(), middleware.audience('member')])
