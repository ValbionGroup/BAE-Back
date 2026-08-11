import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { JobFactory } from '#database/factories/job_factory'
import type { JobPeriod } from '#services/matching_service'

const jobs: Array<{ name: string; type: JobPeriod }> = [
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
  async run() {
    await JobFactory.merge(jobs).createMany(jobs.length)
  }
}
