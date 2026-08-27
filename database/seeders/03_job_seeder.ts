import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Job from '#models/job'
import { DEMO_ONLY } from '#database/seeder_environment'
import type { JobPeriod } from '#services/matching_service'

const JOBS: readonly { name: string; type: JobPeriod }[] = [
  { name: 'Installation des tables', type: 'before' },
  { name: 'Décoration de la salle', type: 'before' },
  { name: 'Service', type: 'during' },
  { name: 'Barbecue', type: 'during' },
  { name: 'Accueil', type: 'during' },
  { name: 'Vaisselle', type: 'after' },
  { name: 'Rangement', type: 'after' },
  { name: 'Nettoyage des sols', type: 'after' },
]

export default class extends BaseSeeder {
  /**
   * ⚠️ **Démo seulement.** Le découpage d'une soirée en postes est propre à
   * chaque BAE : le nôtre fait un barbecue, un autre non. Ces huit postes sont
   * un jeu de démonstration plausible, pas un référentiel — la page
   * Coordination les crée et les renomme (`job:write`, `job:delete`), et un
   * seed de production réintroduirait à chaque déploiement des postes que le
   * bureau aurait supprimés.
   */
  static environment = DEMO_ONLY

  async run() {
    await Job.fetchOrCreateMany(
      'name',
      JOBS.map((job) => ({ name: job.name, type: job.type }))
    )
  }
}
