import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/members', [controllers.Members, 'index']).use(middleware.can('member:read'))
    router.post('/members', [controllers.Members, 'store']).use(middleware.can('member:write'))
    router.get('/members/:id', [controllers.Members, 'show']).use(middleware.can('member:read'))
    router
      .route('/members/:id', ['PUT', 'PATCH'], [controllers.Members, 'update'])
      .use(middleware.can('member:write'))
    router
      .delete('/members/:id', [controllers.Members, 'destroy'])
      .use(middleware.can('member:write'))

    router.get('/roles', [controllers.Roles, 'index']).use(middleware.can('role:read'))
    router.post('/roles', [controllers.Roles, 'store']).use(middleware.can('role:write'))
    router.get('/roles/:id', [controllers.Roles, 'show']).use(middleware.can('role:read'))
    router
      .route('/roles/:id', ['PUT', 'PATCH'], [controllers.Roles, 'update'])
      .use(middleware.can('role:write'))
    router.delete('/roles/:id', [controllers.Roles, 'destroy']).use(middleware.can('role:write'))
    router
      .put('/roles/:id/permissions', [controllers.Roles, 'syncPermissions'])
      .use(middleware.can('role:write'))

    router.get('/permissions', [controllers.Permissions, 'index']).use(middleware.can('role:read'))
    router
      .get('/permissions/:id', [controllers.Permissions, 'show'])
      .use(middleware.can('role:read'))
  })
  .prefix('/v1')
  .use(middleware.auth())
