import factory from '@adonisjs/lucid/factories'
import Product from '#models/product'

export const ProductFactory = factory
  .define(Product, async ({ faker }) => {
    return {
      name: faker.commerce.productName(),
      isVegetarian: faker.datatype.boolean(),
      description: faker.commerce.productDescription(),
      recipe: faker.lorem.paragraph(),
    }
  })
  .build()
