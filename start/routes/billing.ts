/*
|--------------------------------------------------------------------------
| Billing routes
|--------------------------------------------------------------------------
|
| Transactions, fast passes and vouchers.
|
*/

import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    /**
     * Fast passes
     */
    router.get('/fast-passes', [controllers.FastPasses, 'index'])
    router.post('/fast-passes', [controllers.FastPasses, 'store'])
    router.get('/fast-passes/:id', [controllers.FastPasses, 'show'])
    router.put('/fast-passes/:id', [controllers.FastPasses, 'update'])
    router.delete('/fast-passes/:id', [controllers.FastPasses, 'destroy'])

    /**
     * Transactions (read-only for now — the caisse write path is out of scope).
     *
     * Optional `?event_id=` filters down to the transactions settling an order
     * of that event.
     */
    router.get('/transactions', [controllers.Transactions, 'index'])

    /**
     * Vouchers ("bons d'achat")
     *
     * Un bon d'achat est un objet **au porteur** : sa valeur est dans sa
     * lecture. `GET` est donc gardé comme les écritures, et non laissé ouvert.
     */
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
