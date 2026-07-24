import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/product'
import type Good from '#models/good'
import db from '@adonisjs/lucid/services/db'
import { loadBatchesWithRemaining } from '#services/stock_service'

function minSupplierPrice(good: Good): number | null {
  const prices = good.suppliers
    .map((supplier) => Number(supplier.$extras.pivot_price))
    .filter((price) => !Number.isNaN(price))
  return prices.length > 0 ? Math.min(...prices) : null
}

export default class ProductsController {
  /**
   * Display a list of resource
   */
  async index({ serialize }: HttpContext) {
    return serialize(await Product.query().preload('furnitures').preload('goods'))
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, serialize }: HttpContext) {
    const { name, isVegetarian, description, recipe } = request.all()
    const product = new Product()
    product.name = name
    product.isVegetarian = isVegetarian
    product.description = description
    product.recipe = recipe
    await product.save()
    return serialize(product)
  }

  /**
   * Show individual record
   */
  async show({ params, serialize }: HttpContext) {
    return serialize(
      await Product.query()
        .preload('furnitures')
        .preload('goods')
        .where('id', params.id)
        .firstOrFail()
    )
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, serialize }: HttpContext) {
    const product = await Product.query()
      .preload('furnitures')
      .preload('goods')
      .where('id', params.id)
      .firstOrFail() // We get our product by id
    const { name, isVegetarian, description, recipe } = request.all() // We transfer the new data from the request to constants
    product.name = name // Assigning the data
    product.isVegetarian = isVegetarian // Assigning the data
    product.description = description // Assigning the data
    product.recipe = recipe // Assigning the data
    await product.save() // We save the product to the database
    return serialize(product)
  }

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {
    const product = await Product.query()
      .preload('furnitures')
      .preload('goods')
      .where('id', params.id)
      .firstOrFail() // Get the product by id
    await product.delete()
  }

  async summary({ serialize }: HttpContext) {
    const products = await Product.query()
      .select('products.*')
      .select(
        db.raw(
          `(SELECT ep.price FROM event_products ep JOIN events e ON e.id = ep.event_id WHERE ep.product_id = products.id ORDER BY e.date DESC LIMIT 1) as last_price`
        )
      )
      .preload('goods', (goodsQuery) => goodsQuery.preload('suppliers'))
      .orderBy('name')

    const summaries = products.map((product) => {
      let cost: number | null = 0
      for (const good of product.goods) {
        const minPrice = minSupplierPrice(good)
        if (minPrice === null) {
          cost = null
          break
        }
        cost += Number(good.$extras.pivot_quantity) * minPrice
      }
      const lastPrice = product.$extras.last_price
      return {
        id: product.id,
        name: product.name,
        isVegetarian: product.isVegetarian,
        ingredientCount: product.goods.length,
        lastPrice: lastPrice === null || lastPrice === undefined ? null : Number(lastPrice),
        cost,
      }
    })
    return serialize(summaries)
  }

  async ingredients({ params, serialize }: HttpContext) {
    const product = await Product.query()
      .where('id', params.id)
      .preload('goods', (goodsQuery) => {
        goodsQuery.preload('category')
        goodsQuery.preload('suppliers')
      })
      .firstOrFail()

    const lines = await Promise.all(
      product.goods.map(async (good) => {
        const batches = await loadBatchesWithRemaining(good.id, true)
        const stockQty = batches.reduce((sum, b) => sum + b.remainingQty, 0)
        return {
          id: good.id,
          name: good.name,
          unit: good.unit,
          brand: good.brand,
          category: good.category?.name ?? null,
          rank: good.$extras.pivot_rank,
          quantity: good.$extras.pivot_quantity,
          instruction: good.$extras.pivot_instruction,
          unitPrice: minSupplierPrice(good),
          stockQty,
        }
      })
    )
    lines.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    return serialize(lines)
  }
}
