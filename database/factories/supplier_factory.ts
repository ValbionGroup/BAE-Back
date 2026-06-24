import factory from '@adonisjs/lucid/factories'
import Supplier from '#models/supplier'

export const SupplierFactory = factory
  .define(Supplier, async ({ faker }) => {
    return {
      name: faker.company.name(),
    }
  })
  .build()
