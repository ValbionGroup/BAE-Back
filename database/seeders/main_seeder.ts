import { BaseSeeder } from '@adonisjs/lucid/seeders'
import CategorySeeder from './category_seeder.js'
import GoodSeeder from './good_seeder.js'
import FurnitureSeeder from './furniture_seeder.js'
import ProductSeeder from './product_seeder.js'
import ProductGoodSeeder from './product_good_seeder.js'
import ProductFurnitureSeeder from './product_furniture_seeder.js'
import SupplierSeeder from './supplier_seeder.js'
import GoodSupplierSeeder from './good_supplier_seeder.js'

export default class extends BaseSeeder {
  private async runSeeder(Seeder: typeof BaseSeeder) {
    await new Seeder(this.client).run()
  }

  public async run() {
    // 1. Seeders seuls
    await this.runSeeder(CategorySeeder)

    // 2. Seeders dépendants
    await this.runSeeder(GoodSeeder)
    await this.runSeeder(FurnitureSeeder)
    await this.runSeeder(SupplierSeeder)

    // 3. Seeders dépendants des seeders précédents
    await this.runSeeder(ProductSeeder)

    // 4. Seeders dépendants des seeders précédents
    await this.runSeeder(ProductGoodSeeder)
    await this.runSeeder(ProductFurnitureSeeder)
    await this.runSeeder(GoodSupplierSeeder)
  }
}