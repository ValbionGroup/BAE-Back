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
  // ⚠️ Avant l'initialisation de l'auth : `silent_auth_middleware` appelle
  // `auth.check()` sur chaque requête et met le résultat en cache. Poser
  // l'en-tête après lui n'aurait plus aucun effet.
  () => import('#middleware/bearer_from_cookie_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#middleware/silent_auth_middleware'),
  // Après `silent_auth_middleware`, qui est ce qui renseigne `auth.isAuthenticated` :
  // le renouvellement doit savoir si le jeton présenté vaut encore quelque chose.
  () => import('#middleware/renew_session_cookie_middleware'),
  () => import('#middleware/request_logger_middleware'),
])

export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
  can: () => import('#middleware/permission_middleware'),
  // `auth()` ne prouve que l'identité : `audience()` prouve l'appartenance
  // (`member` pour le dashboard, `client` pour la zone publique). Les deux fronts
  // partagent un domaine, donc un même cookie — la distinction se fait ici.
  audience: () => import('#middleware/audience_middleware'),
})
