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
     *
     * `member:read` est dans le socle du catalogue : cette route sert aussi
     * l'accueil et la coordination, pas seulement la page Équipe.
     */
    router.get('/members', [controllers.Members, 'index']).use(middleware.can('member:read'))
    router.post('/members', [controllers.Members, 'store']).use(middleware.can('member:write'))
    router.get('/members/:id', [controllers.Members, 'show']).use(middleware.can('member:read'))
    router
      .route('/members/:id', ['PUT', 'PATCH'], [controllers.Members, 'update'])
      .use(middleware.can('member:write'))
    router
      .delete('/members/:id', [controllers.Members, 'destroy'])
      .use(middleware.can('member:write'))

    /**
     * Roles
     */
    router.get('/roles', [controllers.Roles, 'index']).use(middleware.can('role:read'))
    router.post('/roles', [controllers.Roles, 'store']).use(middleware.can('role:write'))
    router.get('/roles/:id', [controllers.Roles, 'show']).use(middleware.can('role:read'))
    router
      .route('/roles/:id', ['PUT', 'PATCH'], [controllers.Roles, 'update'])
      .use(middleware.can('role:write'))
    router.delete('/roles/:id', [controllers.Roles, 'destroy']).use(middleware.can('role:write'))
    // `put` seul, pas `router.route(path, ['PUT', 'PATCH'], …)` : un remplacement
    // complet n'est pas un PATCH, et déclarer les deux verbes séparément sur la
    // même action fait planter le boot (nom de route auto-dérivé en double).
    router
      .put('/roles/:id/permissions', [controllers.Roles, 'syncPermissions'])
      .use(middleware.can('role:write'))

    /**
     * Permissions
     *
     * Lecture seule : `database/rbac_catalog.ts` est la source unique. Une
     * permission créée à chaud serait une ligne que nul `middleware.can()` ne
     * nomme, donc un garde fantôme qu'aucun typecheck ne peut voir.
     */
    router.get('/permissions', [controllers.Permissions, 'index']).use(middleware.can('role:read'))
    router
      .get('/permissions/:id', [controllers.Permissions, 'show'])
      .use(middleware.can('role:read'))
  })
  .prefix('/v1')
  .use(middleware.auth())
