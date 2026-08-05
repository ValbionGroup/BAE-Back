/*
|--------------------------------------------------------------------------
| Members routes
|--------------------------------------------------------------------------
|
| Members, roles and permissions.
|
*/

import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    /**
     * Members
     */
    router.get('/members', [controllers.Members, 'index'])
    router.post('/members', [controllers.Members, 'store'])
    router.get('/members/:id', [controllers.Members, 'show'])
    router.route('/members/:id', ['PUT', 'PATCH'], [controllers.Members, 'update'])
    router.delete('/members/:id', [controllers.Members, 'destroy'])

    /**
     * Roles
     */
    router.get('/roles', [controllers.Roles, 'index'])
    router.post('/roles', [controllers.Roles, 'store'])
    router.get('/roles/:id', [controllers.Roles, 'show'])
    router.route('/roles/:id', ['PUT', 'PATCH'], [controllers.Roles, 'update'])
    router.delete('/roles/:id', [controllers.Roles, 'destroy'])

    /**
     * Permissions
     */
    router.get('/permissions', [controllers.Permissions, 'index'])
    router.post('/permissions', [controllers.Permissions, 'store'])
    router.get('/permissions/:id', [controllers.Permissions, 'show'])
    router.route('/permissions/:id', ['PUT', 'PATCH'], [controllers.Permissions, 'update'])
    router.delete('/permissions/:id', [controllers.Permissions, 'destroy'])
  })
  .prefix('/v1')
  .use(middleware.auth())
