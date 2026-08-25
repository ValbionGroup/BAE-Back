import factory from '@adonisjs/lucid/factories'
import Restock from '#models/restock'
import { SupplierFactory } from './supplier_factory.ts'
import { MemberFactory } from './members_factory.ts'

export const RestockFactory = factory
  .define(Restock, async ({ faker }) => {
    return {
      totalPrice: faker.number.int({ min: 1000, max: 50000 }),
      memberId: null,
      supplierId: null,
    }
  })
  .relation('member', () => MemberFactory)
  .relation('supplier', () => SupplierFactory)
  .build()
