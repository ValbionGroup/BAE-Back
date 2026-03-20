import { SupplierSchema } from '#database/schema'
import {hasMany, manyToMany} from "@adonisjs/lucid/orm";
import type {HasMany, ManyToMany} from "@adonisjs/lucid/types/relations";
import Good from "#models/good";
import Restock from "#models/restock";

export default class Supplier extends SupplierSchema {
  @manyToMany(() => Good, {
    pivotTimestamps: true,
    pivotColumns: ['price'],
    pivotTable: 'good_suppliers',
  })
  declare goods: ManyToMany<typeof Good>

  @hasMany(() => Restock)
  declare restocks: HasMany<typeof Restock>
}
