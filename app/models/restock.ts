import {RestockSchema} from '#database/schema'
import {belongsTo, hasMany} from "@adonisjs/lucid/orm";
import Member from "#models/member";
import type {BelongsTo, HasMany} from "@adonisjs/lucid/types/relations";
import Supplier from "#models/supplier";
import StockBatch from "#models/stock_batch";


export default class Restock extends RestockSchema {
  @belongsTo(() => Member)
  declare member: BelongsTo<typeof Member>

  @belongsTo(() => Supplier)
  declare supplier: BelongsTo<typeof Supplier>

  @hasMany(() => StockBatch)
  declare stockBatches: HasMany<typeof StockBatch>
}
