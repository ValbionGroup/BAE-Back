import factory from '@adonisjs/lucid/factories'
import Restock from '#models/restock'
import { SupplierFactory } from './supplier_factory.ts'
import { MembersFactory } from './members_factory.ts'

export const RestockFactory = factory
  .define(Restock, async ({ faker }) => {
    return {
      totalPrice: faker.commerce.price(),
      memberId: null, // Will be set by relation
      supplierId: null, // Will be set by relation
    }
  })
  .relation('member', () => MembersFactory)
  .relation('supplier', () => SupplierFactory)
  .build()
