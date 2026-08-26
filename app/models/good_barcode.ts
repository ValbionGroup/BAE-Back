import { GoodBarcodeSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Good from '#models/good'

export default class GoodBarcode extends GoodBarcodeSchema {
  @belongsTo(() => Good)
  declare good: BelongsTo<typeof Good>
}
