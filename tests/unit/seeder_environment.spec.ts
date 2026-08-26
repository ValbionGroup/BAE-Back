import { test } from '@japa/runner'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import app from '@adonisjs/core/services/app'
import type { BaseSeeder } from '@adonisjs/lucid/seeders'

/**
 * Les seeders qui ont leur place dans une base de production : le catalogue
 * RBAC, les postes et les onglets de la caisse. Tous les autres inventent des
 * membres, des soirées ou des mouvements de stock.
 *
 * Ajouter un seeder à cette liste, c'est décider qu'il s'exécutera chez le
 * client — `db:seed` n'ayant pas de garde `--force`, ce fichier est le seul
 * endroit où ce choix se relit.
 */
const REFERENCE_SEEDERS = [
  '01_role_seeder',
  '02_permission_seeder',
  '03_job_seeder',
  '05_role_permission_seeder',
  '24_product_category_seeder',
]

async function loadSeeders(): Promise<{ name: string; environment: string[] | undefined }[]> {
  const directory = app.seedersPath()
  const entries = await readdir(directory)
  const files = entries.filter((file) => file.endsWith('.ts')).sort()

  return Promise.all(
    files.map(async (file) => {
      const module = await import(pathToFileURL(join(directory, file)).href)
      return {
        name: file.replace(/\.ts$/, ''),
        environment: (module.default as typeof BaseSeeder).environment,
      }
    })
  )
}

test.group('Seeder environments', () => {
  test('a seeder of invented data never runs in production', async ({ assert }) => {
    const seeders = await loadSeeders()
    assert.isNotEmpty(seeders)

    for (const seeder of seeders.filter(({ name }) => !REFERENCE_SEEDERS.includes(name))) {
      assert.isArray(
        seeder.environment,
        `${seeder.name} sème des données inventées sans « static environment »`
      )
      assert.notInclude(
        seeder.environment!,
        'production',
        `${seeder.name} sème des données inventées en production`
      )
    }
  })

  test('a seeder of reference data stays eligible everywhere', async ({ assert }) => {
    const seeders = await loadSeeders()
    const names = seeders.map(({ name }) => name)

    for (const name of REFERENCE_SEEDERS) {
      assert.include(names, name, `${name} a disparu de database/seeders`)
      assert.isUndefined(
        seeders.find((seeder) => seeder.name === name)!.environment,
        `${name} porte les données de référence et ne doit être restreint à aucun environnement`
      )
    }
  })
})
