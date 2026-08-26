import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DEMO_ONLY } from '#database/seeder_environment'
import { RestockFactory } from '#database/factories/restock_factory'
import Supplier from '#models/supplier'
import Member from '#models/member'

export default class extends BaseSeeder {
  static environment = DEMO_ONLY

  async run() {
    const suppliers = await Supplier.all()
    const members = await Member.all()

    if (suppliers.length === 0) {
      throw new Error('RestockSeeder: no suppliers found. Run supplier_seeder first!')
    }
    if (members.length === 0) {
      throw new Error('RestockSeeder: no members found. Run member_seeder first!')
    }

    await RestockFactory.merge(
      Array.from({ length: 10 }, (_, index) => ({
        supplierId: suppliers[index % suppliers.length].id,
        memberId: members[index % members.length].id,
      }))
    ).createMany(10)
  }
}
