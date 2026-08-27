import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/cors'
import env from '#start/env'
import { allowedOrigins } from '#services/cors_origins'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  /**
   * Enable or disable CORS handling globally.
   */
  enabled: true,

  /**
   * En développement, toute origine est acceptée pour simplifier le duo
   * front/back local. En production, l'allowlist est **dérivée des URL des deux
   * fronts** — voir `allowedOrigins`, qui explique pourquoi elle n'est pas écrite
   * à la main.
   */
  origin: app.inDev ? true : allowedOrigins([env.get('DASHBOARD_URL'), env.get('PUBLIC_APP_URL')]),

  /**
   * HTTP methods accepted for cross-origin requests.
   */
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],

  /**
   * Reflect request headers by default. Use a string array to restrict
   * allowed headers.
   */
  headers: true,

  /**
   * Response headers exposed to the browser.
   */
  exposeHeaders: [],

  /**
   * Allow cookies/authorization headers on cross-origin requests.
   */
  credentials: true,

  /**
   * Durée de mise en cache d'un préflight, en secondes.
   *
   * Toute écriture porte `Content-Type: application/json` et `X-XSRF-TOKEN` :
   * deux en-têtes hors liste blanche CORS, donc un `OPTIONS` obligatoire avant
   * chaque `POST`/`PUT`/`PATCH`/`DELETE`. À 90 s le cache expirait en continu et
   * chaque enregistrement coûtait **deux** allers-retours à travers le proxy —
   * invisible en local, où l'aller-retour est gratuit.
   *
   * 7200 est le plafond de Chrome ; les autres navigateurs retiennent le leur,
   * plus bas. En contrepartie, un changement de l'allowlist (`allowedOrigins`)
   * met jusqu'à 2 h à atteindre un navigateur déjà ouvert : acceptable, ces URL
   * ne bougent qu'au déploiement.
   */
  maxAge: 7200,
})

export default corsConfig
