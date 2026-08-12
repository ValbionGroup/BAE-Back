/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import app from '@adonisjs/core/services/app'
import { middleware } from '#start/kernel'
import { healthChecks } from '#start/health'
import { readFileSync } from 'node:fs'
import '#start/routes/auth'

const appVersion = (() => {
  const fromEnv = process.env.APP_VERSION
  if (fromEnv) return fromEnv

  try {
    const pkg = JSON.parse(readFileSync(app.makePath('package.json'), 'utf-8'))
    return typeof pkg.version === 'string' ? pkg.version : null
  } catch {
    return null
  }
})()

router.get('/', async ({ response }) => {
  const report = await healthChecks.run()

  const problems = report.checks
    .filter((check) => check.status !== 'ok')
    .map((check) => ({
      name: check.name,
      message: check.message,
      status: check.status,
    }))

  const body = {
    infos: "BUREAU DES ALTERNANTS DE L'ENSEIRB-MATMECA API - (c) Valbion Group",
    version: appVersion,
    uptime: process.uptime(),
    health: report.isHealthy,
    status: report.status,
    problems: problems.length ? problems : null,
  }

  return report.isHealthy ? response.ok(body) : response.serviceUnavailable(body)
})

router
  .group(() => {
    router.resource('members', () => import('#controllers/members_controller')).apiOnly()
    router.resource('categories', () => import('#controllers/categories_controller')).apiOnly()
    router.resource('furnitures', () => import('#controllers/furnitures_controller')).apiOnly()
    router.resource('products', () => import('#controllers/products_controller')).apiOnly()
    router.resource('goods', () => import('#controllers/goods_controller')).apiOnly()
    router.resource('suppliers', () => import('#controllers/suppliers_controller')).apiOnly()
    router.resource('restocks', () => import('#controllers/restocks_controller')).apiOnly()
    router
      .resource('stock-batches', () => import('#controllers/stock_batches_controller'))
      .apiOnly()
    router
      .resource('stock-movements', () => import('#controllers/stock_movements_controller'))
      .apiOnly()
    router.resource('logs', () => import('#controllers/logs_controller')).apiOnly()
    router.resource('roles', () => import('#controllers/roles_controller')).apiOnly()
    router.resource('permissions', () => import('#controllers/permissions_controller')).apiOnly()

    router.resource('events', () => import('#controllers/events_controller')).apiOnly()
    router.get('events/:id/response', [
      () => import('#controllers/events_controller'),
      'getResponse',
    ])
    router.post('events/:id/response', [
      () => import('#controllers/events_controller'),
      'setResponse',
    ])
    router.get('events/:id/roster', [() => import('#controllers/events_controller'), 'roster'])

    router.get('products/summary', [() => import('#controllers/products_controller'), 'summary'])
    router.get('products/:id/ingredients', [
      () => import('#controllers/products_controller'),
      'ingredients',
    ])

    router.get('stocks', [() => import('#controllers/stocks_controller'), 'index'])
    router.get('stocks/:id/batches', [() => import('#controllers/stocks_controller'), 'batches'])
    router.post('stocks/:id/batches/:batchId/discard', [
      () => import('#controllers/stocks_controller'),
      'discard',
    ])
  })
  .prefix('/v1')
  .use(middleware.auth())

router.get('/test', async () => {
  return { message: 'ok' }
})
