/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

router.get('/', () => {
  return { hello: 'world' }
})

router.group(() => {}).prefix('/v1')

router
  .group(() => {
    ;(router.resource('members', () => import('#controllers/members_controller')).apiOnly(),
      router.resource('categories', () => import('#controllers/categories_controller')).apiOnly(),
      router.resource('furnitures', () => import('#controllers/furnitures_controller')).apiOnly(),
      router.resource('products', () => import('#controllers/products_controller')).apiOnly(),
      router.resource('goods', () => import('#controllers/goods_controller')).apiOnly(),
      router.resource('suppliers', () => import('#controllers/suppliers_controller')).apiOnly(),
      router.resource('restocks', () => import('#controllers/restocks_controller')).apiOnly(),
      router
        .resource('stock-batches', () => import('#controllers/stock_batches_controller'))
        .apiOnly(),
      router
        .resource('stock-movements', () => import('#controllers/stock_movements_controller'))
        .apiOnly(),
      router.resource('logs', () => import('#controllers/logs_controller')).apiOnly(),
      router.resource('roles', () => import('#controllers/roles_controller')).apiOnly(),
      router.resource('permissions', () => import('#controllers/permissions_controller')).apiOnly())
  })
  .prefix('/v1')

router.get('/test', async () => {
  return { message: 'ok' }
})
