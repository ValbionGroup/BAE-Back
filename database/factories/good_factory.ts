import factory from '@adonisjs/lucid/factories'
import Good from '#models/good'
import { CategoryFactory } from './category_factory.ts'

export const GoodFactory = factory
  .define(Good, async ({ faker }) => {
    return {
      name: faker.commerce.productName(),
      unit: faker.helpers.arrayElement(['pcs', 'kg', 'liter']),
      brand: faker.company.name(),
      categoryId: null, // Will be set by relation
    }
  })
  .relation('category', () => CategoryFactory)
  .build()