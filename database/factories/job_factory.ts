import factory from '@adonisjs/lucid/factories'
import Job from '#models/job'
import { DEFAULT_JOB_PERIOD } from '#services/matching_service'

export const JobFactory = factory
  .define(Job, async ({ faker }) => {
    return {
      name: faker.person.jobTitle(),
      // `jobs.description` est un varchar(255) et la longueur de `paragraph()`
      // n'est pas bornée : sans troncature, un tirage long fait échouer l'insert
      // au hasard, sur n'importe quel test qui crée un poste.
      description: faker.lorem.paragraph().slice(0, 255),
      type: DEFAULT_JOB_PERIOD,
    }
  })
  .build()
