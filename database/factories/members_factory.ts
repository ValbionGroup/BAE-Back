import factory from '@adonisjs/lucid/factories'
import Members from '#models/member'
import { UserFactory } from '#database/factories/user_factory'

export const MembersFactory = factory
  .define(Members, async ({ faker }) => {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    }
  })
  .relation('user', () => UserFactory)
  .build()