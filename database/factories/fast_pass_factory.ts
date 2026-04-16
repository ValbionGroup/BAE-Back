import factory from '@adonisjs/lucid/factories'
import FastPass from '#models/fast_pass'

export const FastPassFactory = factory
  .define(FastPass, async ({ faker }) => {
    return {
      price: faker.number.float({ min: 1, max: 100 }),
      duration: faker.number.int({ min: 1, max: 60 }),
      description: faker.lorem.sentence(),
      label: faker.lorem.word(),
    }
  })
  .build()