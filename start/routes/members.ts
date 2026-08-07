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
    // `put` seul, pas `router.route(path, ['PUT', 'PATCH'], …)` : un remplacement
    // complet n'est pas un PATCH, et déclarer les deux verbes séparément sur la
    // même action fait planter le boot (nom de route auto-dérivé en double).
    router
      .put('/roles/:id/permissions', [controllers.Roles, 'syncPermissions'])
      .use(middleware.can('role:write'))
    router.delete('/roles/:id', [controllers.Roles, 'destroy'])

    /**
     * Permissions
     *
     * Lecture seule : `database/rbac_catalog.ts` est la source unique. Une
     * permission créée à chaud serait une ligne que nul `middleware.can()` ne
     * nomme, donc un garde fantôme qu'aucun typecheck ne peut voir.
     */
    router.get('/permissions', [controllers.Permissions, 'index'])
    router.get('/permissions/:id', [controllers.Permissions, 'show'])
  })
  .prefix('/v1')
  .use(middleware.auth())
