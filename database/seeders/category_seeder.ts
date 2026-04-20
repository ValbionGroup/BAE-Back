import { BaseSeeder } from '@adonisjs/lucid/seeders'
import {CategoryFactory} from "#database/factories/category_factory";

export default class extends BaseSeeder {
  async run() {
    await CategoryFactory.createMany(10)
  }
}
