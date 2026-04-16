import { BaseSeeder } from '@adonisjs/lucid/seeders'
import GoodSeeder from './good_seeder.js'
import FurnitureSeeder from './furniture_seeder.js'
import ProductSeeder from './product_seeder.js'
import ProductGoodSeeder from './product_good_seeder.js'
import ProductFurnitureSeeder from './product_furniture_seeder.js'
import SupplierSeeder from './supplier_seeder.js'
import GoodSupplierSeeder from './good_supplier_seeder.js'
import MemberSeeder from './member_seeder.ts'
import RestockSeeder from './restock_seeder.ts'
import StockBatchSeeder from './stock_batch_seeder.ts'
import StockMovementSeeder from './stock_movement_seeder.ts'
import LogSeeder from './log_seeder.ts'
import RoleSeeder from './role_seeder.ts'
import PermissionSeeder from './permission_seeder.ts'
//import RolePermissionSeeder from './role_permission_seeder.ts'
import FastPassSeeder from './fast_pass_seeder.ts'
import SubscriptionSeeder from './subscription_seeder.ts'

export default class extends BaseSeeder {
  private async runSeeder(Seeder: typeof BaseSeeder) {
    await new Seeder(this.client).run()
  }

  public async run() {
    // 1. Seeders seuls
    await this.runSeeder(RoleSeeder)
    await this.runSeeder(PermissionSeeder)

    // 2. Seeders dépendants
    await this.runSeeder(MemberSeeder)
    await this.runSeeder(GoodSeeder)
    await this.runSeeder(FurnitureSeeder)
    await this.runSeeder(SupplierSeeder)
    // await this.runSeeder(RolePermissionSeeder)

    // 3. Seeders dépendants des seeders précédents
    await this.runSeeder(ProductSeeder)
    await this.runSeeder(RestockSeeder)
    await this.runSeeder(LogSeeder)
    await this.runSeeder(FastPassSeeder)

    // 4. Seeders dépendants des seeders précédents
    await this.runSeeder(SubscriptionSeeder)
    await this.runSeeder(ProductGoodSeeder)
    await this.runSeeder(ProductFurnitureSeeder)
    await this.runSeeder(GoodSupplierSeeder)
    await this.runSeeder(StockBatchSeeder)

    // 5. Seeders dépendants des seeders précédents
    await this.runSeeder(StockMovementSeeder)
  }
}