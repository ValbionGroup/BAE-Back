import factory from '@adonisjs/lucid/factories'
import Job from '#models/job'

export const JobFactory = factory
  .define(Job, async ({ faker }) => {
    return {
      name: faker.person.jobTitle(),
      description: faker.lorem.paragraph(),
      type: 'during' as const,
    }
  })
  .build()
