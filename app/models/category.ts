import { CategorySchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import Good from '#models/good'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class Category extends CategorySchema {
  @hasMany(() => Good)
  declare goods: HasMany<typeof Good>
}
