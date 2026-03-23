import { StockMovementSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import StockBatch from '#models/stock_batch'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Good from '#models/good'

export default class StockMovement extends StockMovementSchema {
  @belongsTo(() => StockBatch)
  declare stockBatch: BelongsTo<typeof StockBatch>

  @belongsTo(() => Good)
  declare good: BelongsTo<typeof Good>
}
