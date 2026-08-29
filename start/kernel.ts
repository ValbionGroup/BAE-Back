import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
  () => import('#middleware/force_json_response_middleware'),
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
])

router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('#middleware/case_converter_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
  () => import('#middleware/bearer_from_cookie_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#middleware/silent_auth_middleware'),
  () => import('#middleware/renew_session_cookie_middleware'),
  () => import('#middleware/request_logger_middleware'),
])

export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
  can: () => import('#middleware/permission_middleware'),
  audience: () => import('#middleware/audience_middleware'),
})
