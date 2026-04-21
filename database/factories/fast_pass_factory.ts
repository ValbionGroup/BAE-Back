import factory from '@adonisjs/lucid/factories'
import FastPass from '#models/fast_pass'

export const FastPassFactory = factory
  .define(FastPass, async ({ faker }) => {
    return {
      label: faker.helpers.arrayElement(['1 year', '2 year', '3 year']),
      description: faker.lorem.sentence(),
      price: faker.number.int({ min: 10, max: 100 }),
      duration: faker.number.int({ min: 1, max: 12 }),
    }
  })
  .build()
