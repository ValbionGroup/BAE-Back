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
import { healthChecks } from '#start/health'
import { readFileSync } from 'node:fs'

import '#start/routes/auth'
import '#start/routes/members'
import '#start/routes/catalog'
import '#start/routes/stocks'
import '#start/routes/events'
import '#start/routes/coordination'
import '#start/routes/billing'
import '#start/routes/system'
import '#start/routes/realtime'
import '#start/routes/public'

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
