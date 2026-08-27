import { StorageLocationSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import Good from '#models/good'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class StorageLocation extends StorageLocationSchema {
  @hasMany(() => Good)
  declare goods: HasMany<typeof Good>
}
