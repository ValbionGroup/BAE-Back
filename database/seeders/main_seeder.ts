import { BaseSeeder } from '@adonisjs/lucid/seeders'
import GoodSeeder from './good_seeder.js'
import FurnitureSeeder from './furniture_seeder.js'
import ProductSeeder from './product_seeder.js'
import ProductGoodSeeder from './product_good_seeder.js'
import ProductFurnitureSeeder from './product_furniture_seeder.js'
import EventProductSeeder from './event_product_seeder.js'
import SupplierSeeder from './supplier_seeder.js'
import GoodSupplierSeeder from './good_supplier_seeder.js'
import MemberSeeder from './member_seeder.js'
import RestockSeeder from './restock_seeder.js'
import StockBatchSeeder from './stock_batch_seeder.js'
import StockMovementSeeder from './stock_movement_seeder.js'
import LogSeeder from './log_seeder.js'
import RoleSeeder from './role_seeder.js'
import PermissionSeeder from './permission_seeder.js'
import RolePermissionSeeder from './role_permission_seeder.js'
import EventSeeder from './event_seeder.js'
import JobSeeder from './job_seeder.js'
import TransactionSeeder from './transaction_seeder.js'
import FastPassSeeder from './fast_pass_seeder.js'
import SubscriptionSeeder from './subscription_seeder.js'

export default class extends BaseSeeder {
  private async runSeeder(Seeder: typeof BaseSeeder) {
    await new Seeder(this.client).run()
  }

  public async run() {
    // 1. Seeders seuls (no dependencies)
    await this.runSeeder(RoleSeeder)
    await this.runSeeder(PermissionSeeder)
    await this.runSeeder(JobSeeder)
    await this.runSeeder(TransactionSeeder)

    // 2. Seeders dépendants (depends on step 1)
    await this.runSeeder(RolePermissionSeeder)
    await this.runSeeder(MemberSeeder)
    await this.runSeeder(GoodSeeder)
    await this.runSeeder(FurnitureSeeder)
    await this.runSeeder(SupplierSeeder)
    await this.runSeeder(EventSeeder)
    await this.runSeeder(FastPassSeeder)

    // 3. Seeders dépendants des seeders précédents
    await this.runSeeder(ProductSeeder)
    await this.runSeeder(RestockSeeder)
    await this.runSeeder(LogSeeder)

    // 4. Seeders dépendants des seeders précédents
    await this.runSeeder(SubscriptionSeeder)
    await this.runSeeder(ProductGoodSeeder)
    await this.runSeeder(ProductFurnitureSeeder)
    await this.runSeeder(EventProductSeeder)
    await this.runSeeder(GoodSupplierSeeder)
    await this.runSeeder(StockBatchSeeder)

    // 5. Seeders dépendants des seeders précédents
    await this.runSeeder(StockMovementSeeder)
  }
}
