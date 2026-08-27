import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router
      .get('/categories', [controllers.Categories, 'index'])
      .use(middleware.can('category:read'))
    router
      .post('/categories', [controllers.Categories, 'store'])
      .use(middleware.can('category:write'))
    router
      .get('/categories/:id', [controllers.Categories, 'show'])
      .use(middleware.can('category:read'))
    router
      .route('/categories/:id', ['PUT', 'PATCH'], [controllers.Categories, 'update'])
      .use(middleware.can('category:write'))
    router
      .delete('/categories/:id', [controllers.Categories, 'destroy'])
      .use(middleware.can('category:delete'))

    // Le référentiel de **vente**, qui classe les recettes pour le menu et la
    // caisse. `product:*` et non `category:*` : ce ne sont pas les denrées.
    router
      .get('/product-categories', [controllers.ProductCategories, 'index'])
      .use(middleware.can('product:read'))
    router
      .post('/product-categories', [controllers.ProductCategories, 'store'])
      .use(middleware.can('product:write'))
    // ⚠️ `router.route(path, ['PUT','PATCH'], …)` et non deux déclarations : le
    // nom de route auto-dérivé serait en double et le boot planterait.
    router
      .route('/product-categories/:id', ['PUT', 'PATCH'], [controllers.ProductCategories, 'update'])
      .use(middleware.can('product:write'))
    router
      .delete('/product-categories/:id', [controllers.ProductCategories, 'destroy'])
      .use(middleware.can('product:delete'))

    // Où les denrées se **rangent**, quand `/categories` dit ce qu'elles sont.
    // Les deux vocabulaires sont distincts et peuvent partager un mot, d'où deux
    // référentiels et deux triplets de permissions.
    router
      .get('/storage-locations', [controllers.StorageLocations, 'index'])
      .use(middleware.can('storage-location:read'))
    router
      .post('/storage-locations', [controllers.StorageLocations, 'store'])
      .use(middleware.can('storage-location:write'))
    router
      .get('/storage-locations/:id', [controllers.StorageLocations, 'show'])
      .use(middleware.can('storage-location:read'))
    router
      .route('/storage-locations/:id', ['PUT', 'PATCH'], [controllers.StorageLocations, 'update'])
      .use(middleware.can('storage-location:write'))
    router
      .delete('/storage-locations/:id', [controllers.StorageLocations, 'destroy'])
      .use(middleware.can('storage-location:delete'))

    router
      .get('/products/summary', [controllers.Products, 'summary'])
      .use(middleware.can('product:read'))
    router
      .get('/products/:id/ingredients', [controllers.Products, 'ingredients'])
      .use(middleware.can('product:read'))
    router
      .get('/products/:id/recipe/pdf', [controllers.Products, 'recipePdf'])
      .use(middleware.can('product:read'))
    router.get('/products', [controllers.Products, 'index']).use(middleware.can('product:read'))
    router.post('/products', [controllers.Products, 'store']).use(middleware.can('product:write'))
    router.get('/products/:id', [controllers.Products, 'show']).use(middleware.can('product:read'))
    router
      .route('/products/:id', ['PUT', 'PATCH'], [controllers.Products, 'update'])
      .use(middleware.can('product:write'))
    router
      .delete('/products/:id', [controllers.Products, 'destroy'])
      .use(middleware.can('product:delete'))

    router.get('/goods', [controllers.Goods, 'index']).use(middleware.can('good:read'))
    router.post('/goods', [controllers.Goods, 'store']).use(middleware.can('good:write'))
    router.get('/goods/:id', [controllers.Goods, 'show']).use(middleware.can('good:read'))
    router
      .route('/goods/:id', ['PUT', 'PATCH'], [controllers.Goods, 'update'])
      .use(middleware.can('good:write'))
    router.delete('/goods/:id', [controllers.Goods, 'destroy']).use(middleware.can('good:delete'))

    // Le code appartient à la denrée qu'il désigne : `good:write`. Le scanner est
    // le seul à en poser, à la validation de son lot.
    router
      .post('/goods/:id/barcodes', [controllers.Goods, 'attachBarcode'])
      .use(middleware.can('good:write'))
    router
      .delete('/goods/:id/barcodes/:code', [controllers.Goods, 'removeBarcode'])
      .use(middleware.can('good:write'))

    // Le tarif appartient à la **denrée** qu'on enrichit, pas à l'enseigne :
    // `good:write`, et non `supplier:write`. Patron de
    // `PUT /events/:id/sponsorship-categories/:categoryId/prices`.
    router
      .put('/goods/:id/suppliers/:supplierId', [controllers.Goods, 'setSupplierPrice'])
      .use(middleware.can('good:write'))
    router
      .delete('/goods/:id/suppliers/:supplierId', [controllers.Goods, 'removeSupplierPrice'])
      .use(middleware.can('good:write'))

    router
      .get('/furnitures', [controllers.Furnitures, 'index'])
      .use(middleware.can('furniture:read'))
    router
      .post('/furnitures', [controllers.Furnitures, 'store'])
      .use(middleware.can('furniture:write'))
    router
      .get('/furnitures/:id', [controllers.Furnitures, 'show'])
      .use(middleware.can('furniture:read'))
    router
      .route('/furnitures/:id', ['PUT', 'PATCH'], [controllers.Furnitures, 'update'])
      .use(middleware.can('furniture:write'))
    router
      .delete('/furnitures/:id', [controllers.Furnitures, 'destroy'])
      .use(middleware.can('furniture:delete'))

    router.get('/suppliers', [controllers.Suppliers, 'index']).use(middleware.can('supplier:read'))
    router
      .post('/suppliers', [controllers.Suppliers, 'store'])
      .use(middleware.can('supplier:write'))
    router
      .get('/suppliers/:id', [controllers.Suppliers, 'show'])
      .use(middleware.can('supplier:read'))
    router
      .route('/suppliers/:id', ['PUT', 'PATCH'], [controllers.Suppliers, 'update'])
      .use(middleware.can('supplier:write'))
    router
      .delete('/suppliers/:id', [controllers.Suppliers, 'destroy'])
      .use(middleware.can('supplier:delete'))
  })
  .prefix('/v1')
  .use([middleware.auth(), middleware.audience('member')])
