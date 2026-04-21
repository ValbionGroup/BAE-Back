import factory from '@adonisjs/lucid/factories'
import StockMovement from '#models/stock_movement'
import { GoodFactory } from './good_factory.ts'
import { StockBatchFactory } from './stock_batch_factory.ts'

export const StockMovementFactory = factory
  .define(StockMovement, async ({ faker }) => {
    return {
      quantity: faker.number.int({ min: 1, max: 100 }).toString(),
      movementType: faker.helpers.arrayElement(['in', 'out']),
      goodId: undefined,
      stockBatchId: undefined,
    }
  })
  .relation('good', () => GoodFactory)
  .relation('stockBatch', () => StockBatchFactory)
  .build()
