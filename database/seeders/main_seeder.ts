import { BaseSeeder } from '@adonisjs/lucid/seeders'
import CategorySeeder from './category_seeder.js'
import GoodSeeder from './good_seeder.js'
import FurnitureSeeder from './furniture_seeder.js'
import ProductSeeder from './product_seeder.js'
import ProductGoodSeeder from './product_good_seeder.js'
import ProductFurnitureSeeder from './product_furniture_seeder.js'

export default class extends BaseSeeder {
  private async runSeeder(Seeder: typeof BaseSeeder) {
    await new Seeder(this.client).run()
  }

  public async run() {
    // 1. D'abord les catégories
    await this.runSeeder(CategorySeeder)

    // 2. Ensuite goods et furnitures (qui dépendent des catégories)
    await this.runSeeder(GoodSeeder)
    await this.runSeeder(FurnitureSeeder)

    // 3. Ensuite products
    await this.runSeeder(ProductSeeder)

    // 4. Enfin les relations many-to-many
    await this.runSeeder(ProductGoodSeeder)
    await this.runSeeder(ProductFurnitureSeeder)
  }
}