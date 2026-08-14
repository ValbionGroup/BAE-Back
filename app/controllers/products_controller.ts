import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/product'
import Good from '#models/good'
import db from '@adonisjs/lucid/services/db'
import ApiException from '#exceptions/api_exception'
import { loadBatchesWithRemaining } from '#services/stock_service'
import { minSupplierPrice } from '#services/pricing_service'

// TODO: consume `#services/product_category_service`, of which this is an exact
// copy — while both definitions coexist they can drift apart, and the same
// product would change category depending on which screen looks at it.
function primaryCategoryName(product: Product): string | null {
  const [primary] = [...product.goods].sort(
    (a, b) =>
      Number(a.$extras.pivot_rank ?? 0) - Number(b.$extras.pivot_rank ?? 0) ||
      a.name.localeCompare(b.name)
  )
  return primary?.category?.name ?? null
}

// Every pivot pointing at `products` is `ON DELETE CASCADE`: deleting a recipe
// does not orphan its sales, it erases them. These are the tables whose rows are
// history, and whose presence therefore forbids the deletion.
const PRODUCT_USAGES = [
  { table: 'order_products', singular: 'commande', plural: 'commandes' },
  { table: 'event_products', singular: 'menu de soirée', plural: 'menus de soirée' },
  { table: 'pre_order_items', singular: 'précommande', plural: 'précommandes' },
  // The RESTRICT foreign key on production_runs.product_id already refuses the
  // delete — but as an unhandled 500. This entry is what turns that refusal into
  // a 409 that says why.
  { table: 'production_runs', singular: 'production', plural: 'productions' },
] as const

async function usageLabels(productId: number): Promise<string[]> {
  const counts = await Promise.all(
    PRODUCT_USAGES.map(async ({ table, singular, plural }) => {
      const row = await db.from(table).where('product_id', productId).count('* as total').first()
      return { singular, plural, total: Number(row?.total ?? 0) }
    })
  )
  return counts
    .filter((usage) => usage.total > 0)
    .map((usage) => `${usage.total} ${usage.total > 1 ? usage.plural : usage.singular}`)
}

interface IngredientInput {
  goodId: number
  quantity: number
  instruction: string | null
}

function badRequest(message: string): never {
  throw new ApiException('E_PRODUCT_INVALID', message, 400)
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseIngredients(raw: unknown): IngredientInput[] {
  if (!Array.isArray(raw)) badRequest('La liste des ingrédients doit être un tableau.')

  const seen = new Set<number>()
  return raw.map((entry) => {
    const line = entry as Record<string, unknown> | null
    const goodId = Number(line?.goodId)
    if (!Number.isInteger(goodId) || goodId <= 0) {
      badRequest('Chaque ingrédient doit désigner un produit du catalogue.')
    }
    if (seen.has(goodId)) {
      badRequest('Un même produit ne peut pas figurer deux fois dans une recette.')
    }
    seen.add(goodId)

    const quantity = Number(line?.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      badRequest("La quantité d'un ingrédient doit être un entier supérieur à zéro.")
    }

    return { goodId, quantity, instruction: normalizeText(line?.instruction) }
  })
}

async function assertGoodsExist(ingredients: IngredientInput[]): Promise<void> {
  if (ingredients.length === 0) return
  const ids = ingredients.map((line) => line.goodId)
  const found = await Good.query().whereIn('id', ids).select('id')
  const missing = ids.filter((id) => !found.some((good) => good.id === id))
  if (missing.length > 0) badRequest(`Produit introuvable au catalogue : ${missing.join(', ')}.`)
}

function pivotPayload(ingredients: IngredientInput[]) {
  return Object.fromEntries(
    ingredients.map((line, index) => [
      line.goodId,
      { quantity: line.quantity, rank: index + 1, instruction: line.instruction },
    ])
  )
}

export default class ProductsController {
  async index({ serialize }: HttpContext) {
    return serialize(await Product.query().preload('furnitures').preload('goods'))
  }

  async store({ request, serialize }: HttpContext) {
    const payload = request.all()
    const name = normalizeText(payload.name)
    if (name === null) badRequest('Le nom de la recette est obligatoire.')

    const ingredients = 'goods' in payload ? parseIngredients(payload.goods) : []
    await assertGoodsExist(ingredients)

    const product = await db.transaction(async (trx) => {
      const created = new Product()
      created.useTransaction(trx)
      created.name = name
      created.isVegetarian = payload.isVegetarian ?? false
      created.description = normalizeText(payload.description)
      created.recipe = normalizeText(payload.recipe)
      await created.save()
      if (ingredients.length > 0) await created.related('goods').sync(pivotPayload(ingredients))
      return created
    })

    return serialize(product)
  }

  async show({ params, serialize }: HttpContext) {
    return serialize(
      await Product.query()
        .preload('furnitures')
        .preload('goods')
        .where('id', params.id)
        .firstOrFail()
    )
  }

  async update({ params, request, serialize }: HttpContext) {
    const product = await Product.findOrFail(params.id)
    const payload = request.all()

    const name = normalizeText(payload.name)
    if (name === null) badRequest('Le nom de la recette est obligatoire.')

    const ingredients = 'goods' in payload ? parseIngredients(payload.goods) : null
    if (ingredients !== null) await assertGoodsExist(ingredients)

    await db.transaction(async (trx) => {
      product.useTransaction(trx)
      product.name = name
      product.isVegetarian = payload.isVegetarian ?? false
      product.description = normalizeText(payload.description)
      product.recipe = normalizeText(payload.recipe)
      await product.save()
      if (ingredients !== null) await product.related('goods').sync(pivotPayload(ingredients))
    })

    return serialize(product)
  }

  async destroy({ params, response }: HttpContext) {
    const product = await Product.findOrFail(params.id)
    const usages = await usageLabels(product.id)
    if (usages.length > 0) {
      throw new ApiException(
        'E_PRODUCT_IN_USE',
        `Cette recette est utilisée par ${usages.join(', ')} : la supprimer effacerait cet historique.`,
        409
      )
    }
    await product.delete()
    return response.noContent()
  }

  async summary({ serialize }: HttpContext) {
    const products = await Product.query()
      .select('products.*')
      .select(
        db.raw(
          `(SELECT ep.price FROM event_products ep JOIN events e ON e.id = ep.event_id WHERE ep.product_id = products.id ORDER BY e.date DESC LIMIT 1) as last_price`
        )
      )
      .preload('goods', (goodsQuery) => goodsQuery.preload('suppliers').preload('category'))
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
        category: primaryCategoryName(product),
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
