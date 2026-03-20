import {StockBatchSchema} from '#database/schema'
import {belongsTo, hasMany} from "@adonisjs/lucid/orm";
import Restock from "#models/restock";
import type {BelongsTo, HasMany} from "@adonisjs/lucid/types/relations";
import Good from "#models/good";
import StockMovement from "#models/stock_movement";

export default class StockBatch extends StockBatchSchema {
  @belongsTo(() => Restock)
  declare restock: BelongsTo<typeof Restock>

  @belongsTo(() => Good)
  declare good: BelongsTo<typeof Good>

  @hasMany(() => StockMovement)
  declare movement: HasMany<typeof StockMovement>
}
