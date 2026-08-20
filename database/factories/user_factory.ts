import factory from '@adonisjs/lucid/factories'
import User from '#models/user'

export const UserFactory = factory
  .define(User, async ({ faker }) => {
    return {
      email: faker.internet.email(),
      password: faker.internet.password(),
      casId: faker.string.uuid(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    }
  })
  .build()
