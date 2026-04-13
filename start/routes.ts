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

router.group(() => { }).prefix('/v1')

router.group(() => {
  router.resource('members', () => import('#controllers/members_controller')).apiOnly()
}).prefix('/v1')