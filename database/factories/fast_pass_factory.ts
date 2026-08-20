import factory from '@adonisjs/lucid/factories'
import FastPass from '#models/fast_pass'

export const FastPassFactory = factory
  .define(FastPass, async ({ faker }) => {
    const years = faker.helpers.arrayElement([1, 2, 3])

    return {
      label: years === 1 ? 'Adhésion 1 an' : `Adhésion ${years} ans`,
      description: faker.lorem.sentence(),
      price: years * faker.number.int({ min: 10, max: 12 }),
      duration: years,
    }
  })
  .build()
