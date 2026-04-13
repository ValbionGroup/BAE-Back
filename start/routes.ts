/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import MembersController from '#controllers/members_controller'

router.get('/', () => {
  return { hello: 'world' }
})

router.group(() => { }).prefix('/v1')

router.group(() => {
  router.resource('members', MembersController).apiOnly()
}).prefix('/v1')