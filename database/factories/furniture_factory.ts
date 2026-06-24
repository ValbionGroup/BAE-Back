import factory from '@adonisjs/lucid/factories'
import Furniture from '#models/furniture'

export const FurnitureFactory = factory
  .define(Furniture, async ({ faker }) => {
    return {
      name: faker.commerce.productName(),
      quantity: faker.number.int({ min: 1, max: 100 }),
      price: faker.commerce.price(),
    }
  })
  .build()
