import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Job from '#models/job'
import type { JobPeriod } from '#services/matching_service'

// Le vocabulaire des postes tenus pendant une soirée : semé en production au
// même titre que le catalogue RBAC, donc `fetchOrCreateMany` et non une
// fabrique — un second passage doit retrouver les postes, pas les dupliquer.
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
  async run() {
    await Job.fetchOrCreateMany(
      'name',
      JOBS.map((job) => ({ name: job.name, type: job.type }))
    )
  }
}
