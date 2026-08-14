/*
|--------------------------------------------------------------------------
| Catalog routes
|--------------------------------------------------------------------------
|
| Categories, products, goods, furnitures and suppliers.
|
*/

import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    /**
     * Categories
     */
    router.get('/categories', [controllers.Categories, 'index'])
    router.post('/categories', [controllers.Categories, 'store'])
    router.get('/categories/:id', [controllers.Categories, 'show'])
    router.route('/categories/:id', ['PUT', 'PATCH'], [controllers.Categories, 'update'])
    router.delete('/categories/:id', [controllers.Categories, 'destroy'])

    /**
     * Products
     *
     * /!\ `products/summary` and `products/:id/ingredients` MUST stay above
     * `products/:id`, otherwise `show()` swallows them with id='summary'.
     */
    router.get('/products/summary', [controllers.Products, 'summary'])
    router.get('/products/:id/ingredients', [controllers.Products, 'ingredients'])
    router.get('/products', [controllers.Products, 'index'])
    router.post('/products', [controllers.Products, 'store'])
    router.get('/products/:id', [controllers.Products, 'show'])
    router.route('/products/:id', ['PUT', 'PATCH'], [controllers.Products, 'update'])
    router.delete('/products/:id', [controllers.Products, 'destroy'])

    /**
     * Goods
     */
    router.get('/goods', [controllers.Goods, 'index'])
    router.post('/goods', [controllers.Goods, 'store'])
    router.get('/goods/:id', [controllers.Goods, 'show'])
    router.route('/goods/:id', ['PUT', 'PATCH'], [controllers.Goods, 'update'])
    router.delete('/goods/:id', [controllers.Goods, 'destroy'])

    /**
     * Furnitures
     */
    router.get('/furnitures', [controllers.Furnitures, 'index'])
    router.post('/furnitures', [controllers.Furnitures, 'store'])
    router.get('/furnitures/:id', [controllers.Furnitures, 'show'])
    router.route('/furnitures/:id', ['PUT', 'PATCH'], [controllers.Furnitures, 'update'])
    router.delete('/furnitures/:id', [controllers.Furnitures, 'destroy'])

    /**
     * Suppliers
     */
    router.get('/suppliers', [controllers.Suppliers, 'index'])
    router.post('/suppliers', [controllers.Suppliers, 'store'])
    router.get('/suppliers/:id', [controllers.Suppliers, 'show'])
    router.route('/suppliers/:id', ['PUT', 'PATCH'], [controllers.Suppliers, 'update'])
    router.delete('/suppliers/:id', [controllers.Suppliers, 'destroy'])
  })
  .prefix('/v1')
  .use(middleware.auth())
