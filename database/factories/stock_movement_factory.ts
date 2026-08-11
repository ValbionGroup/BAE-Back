import factory from '@adonisjs/lucid/factories'
import StockMovement from '#models/stock_movement'
import { GoodFactory } from './good_factory.ts'
import { StockBatchFactory } from './stock_batch_factory.ts'

export const StockMovementFactory = factory
  .define(StockMovement, async ({ faker }) => {
    return {
      quantity: faker.number.int({ min: 1, max: 100 }).toString(),
      // Always 'out'. Stock ENTERS through the stock_batches row itself (its
      // `quantity`), never through a movement; an 'in' means a production return
      // and is written explicitly. Drawing the type at random was harmless only
      // while the remaining-quantity formula ignored 'in' — now that it counts
      // them, random entries would inflate seeded dev stock.
      movementType: 'out',
      goodId: undefined,
      stockBatchId: undefined,
    }
  })
  .relation('good', () => GoodFactory)
  .relation('stockBatch', () => StockBatchFactory)
  .build()
