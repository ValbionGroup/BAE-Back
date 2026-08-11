import factory from '@adonisjs/lucid/factories'
import Log from '#models/log'
import { UserFactory } from './user_factory.ts'

export const LogFactory = factory
  .define(Log, async ({ faker }) => {
    return {
      level: faker.helpers.arrayElement(['info', 'warning', 'error']),
      message: faker.lorem.sentence(),
      method: faker.helpers.arrayElement(['GET', 'POST', 'PUT', 'DELETE']),
      url: faker.internet.url(),
      ip: faker.internet.ip(),
      meta: {
        userAgent: faker.internet.userAgent(),
        referrer: faker.internet.url(),
      },
      userId: null,
    }
  })
  .relation('user', () => UserFactory)
  .build()
