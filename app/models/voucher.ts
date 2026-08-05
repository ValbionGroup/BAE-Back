import { VoucherSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Supplier from '#models/supplier'

export default class Voucher extends VoucherSchema {
  @belongsTo(() => Supplier)
  declare supplier: BelongsTo<typeof Supplier>
}
