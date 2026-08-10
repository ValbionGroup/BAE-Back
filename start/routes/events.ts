/*
|--------------------------------------------------------------------------
| Events routes
|--------------------------------------------------------------------------
|
| Events CRUD plus the per-event member response and roster endpoints.
|
*/

import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .group(() => {
    /**
     * Events
     */
    router.get('/events', [controllers.Events, 'index'])
    router.post('/events', [controllers.Events, 'store'])
    router.get('/events/:id', [controllers.Events, 'show'])
    router.route('/events/:id', ['PUT', 'PATCH'], [controllers.Events, 'update'])
    router.delete('/events/:id', [controllers.Events, 'destroy'])

    /**
     * Per-event member response & roster
     */
    router.get('/events/:id/response', [controllers.Events, 'getResponse'])
    router.post('/events/:id/response', [controllers.Events, 'setResponse'])
    router.get('/events/:id/roster', [controllers.Events, 'roster'])

    /**
     * Menu d'une soirée — le pivot `event_products`.
     *
     * Ressource imbriquée et non `/event-products/:id` : le pivot n'a pas d'id
     * propre, sa clé est `(event_id, product_id)`. Le second membre est un
     * identifiant que le client possède déjà, ce qui rend chaque écriture
     * idempotente sans relecture.
     *
     * La lecture est gardée aussi, par une permission de socle : l'accès reste
     * ouvert à tout membre en pratique, mais il devient explicite et révocable.
     */
    router
      .get('/events/:id/products', [controllers.EventProducts, 'index'])
      .use(middleware.can('menu:read'))
    router
      .post('/events/:id/products', [controllers.EventProducts, 'store'])
      .use(middleware.can('menu:write'))
    router
      .patch('/events/:id/products/:productId', [controllers.EventProducts, 'update'])
      .use(middleware.can('menu:write'))
    router
      .delete('/events/:id/products/:productId', [controllers.EventProducts, 'destroy'])
      .use(middleware.can('menu:write'))

    /**
     * `middleware.can` accepte `string | string[]` et exige alors la totalité :
     * les deux permissions se combinent en ET, pas en OU.
     */
    router
      .get('/events/:id/shopping-list', [controllers.EventProducts, 'shoppingList'])
      .use(middleware.can(['menu:read', 'stock:read']))

    /**
     * Running the matching rewrites every unlocked assignment of the evening,
     * so it is coordination work, not something any member may trigger.
     */
    router
      .post('/events/:id/matching', [controllers.Events, 'runMatching'])
      .use(middleware.can('event:matching'))

    /**
     * Closing an evening: consolidates the pending `points_delta` of its
     * assignments into `members.points`. Idempotent — a second call settles
     * nothing.
     *
     * Gated hardest of all: a settled evening makes `runMatching` fail with
     * 409, and the API offers no way back (only the `event:unsettle` ace
     * command does). Left open, one request from any member froze the evening
     * for good.
     */
    router
      .post('/events/:id/settle', [controllers.Events, 'settle'])
      .use(middleware.can('event:settle'))
  })
  .prefix('/v1')
  .use(middleware.auth())
