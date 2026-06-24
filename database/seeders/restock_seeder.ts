import { SupplierFactory } from '#database/factories/supplier_factory'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { RestockFactory } from '#database/factories/restock_factory'
import { MemberFactory } from '#database/factories/members_factory'

export default class extends BaseSeeder {
  async run() {
    // Write your database queries inside the run method
    const suppliers = await SupplierFactory.createMany(5)
    const members = await MemberFactory.createMany(5)

    await RestockFactory.merge(
      Array.from({ length: 10 }, (_, index) => ({
        supplierId: suppliers[index % suppliers.length].id,
        memberId: members[index % members.length].id,
      }))
    ).createMany(10)
  }
}
