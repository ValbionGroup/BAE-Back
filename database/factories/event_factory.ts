import factory from '@adonisjs/lucid/factories'
import Event from '#models/event'
import { DateTime } from 'luxon'

export const EventFactory = factory
  .define(Event, async ({ faker }) => {
    return {
      name: faker.company.catchPhrase(),
      description: faker.lorem.paragraph(),
      date: DateTime.fromJSDate(faker.date.future()),
      status: faker.helpers.arrayElement(['scheduled', 'ongoing', 'completed']),
    }
  })
  .build()
