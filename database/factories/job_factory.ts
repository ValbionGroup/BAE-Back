import factory from '@adonisjs/lucid/factories'
import Job from '#models/job'
import { DEFAULT_JOB_PERIOD } from '#services/matching_service'

export const JobFactory = factory
  .define(Job, async ({ faker }) => {
    return {
      name: faker.person.jobTitle(),
      description: faker.lorem.paragraph(),
      type: DEFAULT_JOB_PERIOD,
    }
  })
  .build()
