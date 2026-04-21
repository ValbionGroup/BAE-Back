import factory from '@adonisjs/lucid/factories'
import StockBatch from '#models/stock_batch'
import { RestockFactory } from './restock_factory.ts'
import { GoodFactory } from './good_factory.ts'
import { DateTime } from 'luxon'

export const StockBatchFactory = factory
  .define(StockBatch, async ({ faker }) => {
    return {
      expirationDate: DateTime.fromJSDate(faker.date.future()),
      label: faker.commerce.productName(),
      quantity: faker.number.int({ min: 1, max: 100 }).toString(),
      restockId: null, // Will be set by relation
      goodId: null, // Will be set by relation
    }
  })
  .relation('restock', () => RestockFactory)
  .relation('good', () => GoodFactory)
  .build()
