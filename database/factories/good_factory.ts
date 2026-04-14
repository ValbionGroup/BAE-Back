import factory from '@adonisjs/lucid/factories'
import Good from '#models/good'

export const GoodFactory = factory
  .define(Good, async ({ faker }) => {
    return {
      name: faker.commerce.productName(),
      unit: faker.helpers.arrayElement(['pcs', 'kg', 'liter']),
      brand: faker.company.name(),
    }
  })
  .build()