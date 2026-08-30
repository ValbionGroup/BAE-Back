import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/events', [controllers.PublicCatalog, 'events'])
    router.get('/events/:id/menu', [controllers.PublicCatalog, 'menu'])
    router.get('/fast-passes', [controllers.PublicCatalog, 'fastPasses'])
  })
  .prefix('v1/public')
  .as('public_catalog')

router
  .group(() => {
    router.get('/pre-orders', [controllers.AccountPurchases, 'preOrders'])
    router.get('/pre-orders/:id', [controllers.AccountPurchases, 'preOrder'])
    router.get('/pre-orders/:id/qr', [controllers.AccountPurchases, 'preOrderQr'])
    router.get('/subscriptions', [controllers.AccountPurchases, 'subscriptions'])
    router.get('/orders', [controllers.AccountPurchases, 'orders'])

    router
      .post('/subscriptions', [controllers.AccountPayments, 'subscribe'])
      .use(middleware.audience('client'))
    router
      .post('/pre-orders', [controllers.AccountPayments, 'preOrder'])
      .use(middleware.audience('client'))
    router
      .get('/payments/:orderRef', [controllers.AccountPayments, 'show'])
      .use(middleware.audience('client'))
  })
  .prefix('v1/account')
  .as('account_purchases')
  .use(middleware.auth())

router
  .group(() => {
    router.post('/callback/:orderRef', [controllers.LydiaCallbacks, 'notify'])
  })
  .prefix('v1/lydia')
  .as('lydia')

router
  .group(() => {
    router.post('/callback/:orderRef', [controllers.SumupCallbacks, 'notify'])
  })
  .prefix('v1/sumup')
  .as('sumup')

router
  .group(() => {
    router.post('/webhook', [controllers.TelegramWebhook, 'notify'])
  })
  .prefix('v1/telegram')
  .as('telegram')
