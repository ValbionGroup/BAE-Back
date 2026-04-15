import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { GoodFactory } from '#database/factories/good_factory'
import { CategoryFactory } from '#database/factories/category_factory'

export default class extends BaseSeeder {
  public async run () {
    // 1. Créer des catégories
    const categories = await CategoryFactory.createMany(3)

    // 2. Créer des goods liés aux catégories
    await GoodFactory
      .merge(
        Array.from({ length: 10 }, (_, index) => ({
          categoryId: categories[index % categories.length].id,
        }))
      )
      .createMany(10)
  }
}