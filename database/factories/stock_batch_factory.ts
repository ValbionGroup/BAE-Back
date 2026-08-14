import factory from '@adonisjs/lucid/factories'
import StockBatch from '#models/stock_batch'
import { RestockFactory } from './restock_factory.ts'
import { GoodFactory } from './good_factory.ts'
import { DateTime } from 'luxon'

export const StockBatchFactory = factory
  .define(StockBatch, async ({ faker }) => {
    return {
      expirationDate: DateTime.fromJSDate(faker.date.future()),
      // A lot number, not a product name. `faker.commerce.productName()` filled
      // this column with "Handmade Bamboo Ball", which is what the Stocks panel
      // then displayed as the number to read off the shelf. The shape mirrors
      // StockBatchesController.nextLabel(): L<yy>-<n>.
      label: `L${String(new Date().getFullYear()).slice(-2)}-${faker.number.int({ min: 1, max: 999 })}`,
      quantity: faker.number.int({ min: 1, max: 100 }).toString(),
      restockId: null,
      goodId: null,
    }
  })
  .relation('restock', () => RestockFactory)
  .relation('good', () => GoodFactory)
  .build()
