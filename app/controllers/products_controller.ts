import type { HttpContext } from '@adonisjs/core/http'
import Product from '#models/product'
import Good from '#models/good'
import db from '@adonisjs/lucid/services/db'
import ApiException from '#exceptions/api_exception'
import { loadBatchesWithRemaining } from '#services/stock_service'
import { minSupplierPrice } from '#services/pricing_service'
import { buildRecipeHtml } from '#services/print/print_recipe'
import { printFooterTemplate } from '#services/print/print_layout'
import { pdfService } from '#services/pdf_service'
import ProductCategory from '#models/product_category'
import { productUpdateValidator, productValidator } from '#validators/product'

/**
 * Vérifié explicitement : sans ça, un identifiant inconnu remonterait en
 * violation de clé étrangère, donc en 500 illisible. Même règle que
 * `GoodsController.setSupplierPrice`.
 */
async function assertCategoryExists(id: number | null | undefined): Promise<void> {
  if (id === null || id === undefined) return
  const found = await ProductCategory.find(id)
  if (!found) {
    throw new ApiException(
      'E_PRODUCT_CATEGORY_NOT_FOUND',
      "Cette catégorie de recette n'existe pas.",
      404
    )
  }
}

// Every pivot pointing at `products` is `ON DELETE CASCADE`: deleting a recipe
// does not orphan its sales, it erases them. These are the tables whose rows are
// history, and whose presence therefore forbids the deletion.
const PRODUCT_USAGES = [
  { table: 'order_products', singular: 'commande', plural: 'commandes' },
  { table: 'event_products', singular: 'menu de soirée', plural: 'menus de soirée' },
  { table: 'pre_order_items', singular: 'précommande', plural: 'précommandes' },
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

export interface IngredientLine {
  id: number
  name: string
  unit: string
  rank: number
  quantity: number
  instruction: string | null
}

/**
 * Shared by `ingredients()` (JSON, layers on category/price/stock) and
 * `recipePdf()` (only needs the assembly order and quantities).
 */
async function loadIngredientLines(productId: string): Promise<{
  productName: string
  isVegetarian: boolean
  description: string | null
  recipe: string | null
  lines: IngredientLine[]
}> {
  const product = await Product.query()
    .where('id', productId)
    .preload('goods', (goodsQuery) => {
      goodsQuery.preload('category')
      goodsQuery.preload('suppliers')
    })
    .firstOrFail()

  const lines: IngredientLine[] = product.goods.map((good) => ({
    id: good.id,
    name: good.name,
    unit: good.unit,
    rank: Number(good.$extras.pivot_rank),
    quantity: Number(good.$extras.pivot_quantity),
    instruction: good.$extras.pivot_instruction,
  }))
  lines.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))

  return {
    productName: product.name,
    isVegetarian: product.isVegetarian ?? false,
    description: product.description,
    recipe: product.recipe,
    lines,
  }
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

    // Fractionnaire : une recette consomme 1/12 de paquet de pains, pas 12.
    const quantity = Number(line?.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      badRequest("La quantité d'un ingrédient doit être un nombre supérieur à zéro.")
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
    const payload = await request.validateUsing(productValidator)
    // `goods` reste hors validateur : `parseIngredients` fait plus qu'une
    // validation de forme, cf. `#validators/product`.
    const raw = request.all()
    const ingredients = 'goods' in raw ? parseIngredients(raw.goods) : []
    await assertGoodsExist(ingredients)
    await assertCategoryExists(payload.productCategoryId)

    const product = await db.transaction(async (trx) => {
      const created = new Product()
      created.useTransaction(trx)
      created.name = payload.name
      created.isVegetarian = payload.isVegetarian ?? false
      created.description = payload.description ?? null
      created.recipe = payload.recipe ?? null
      created.productCategoryId = payload.productCategoryId ?? null
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
    const payload = await request.validateUsing(productUpdateValidator)

    const raw = request.all()
    const ingredients = 'goods' in raw ? parseIngredients(raw.goods) : null
    if (ingredients !== null) await assertGoodsExist(ingredients)
    await assertCategoryExists(payload.productCategoryId)

    await db.transaction(async (trx) => {
      product.useTransaction(trx)
      product.name = payload.name
      product.isVegetarian = payload.isVegetarian ?? false
      product.description = payload.description ?? null
      product.recipe = payload.recipe ?? null
      // ⚠️ Seulement si la clé est **présente** : une écriture qui tait la
      // catégorie ne doit pas déclasser la recette. Vine omet les clés absentes,
      // c'est ce qui rend le test possible.
      if ('productCategoryId' in payload) {
        product.productCategoryId = payload.productCategoryId ?? null
      }
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
      // `suppliers` reste — il porte les prix dont dérive le coût. `category`
      // sur les denrées ne servait qu'à la catégorie dérivée.
      .preload('goods', (goodsQuery) => goodsQuery.preload('suppliers'))
      .preload('productCategory')
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
      // ⚠️ Ce `Number()` reste, contrairement à ses voisins supprimés ailleurs :
      // `last_price` vient d'un `db.raw` (sous-requête corrélée), dont Lucid ne
      // type pas le retour. La coercion y est légitime.
      const lastPrice = product.$extras.last_price
      return {
        id: product.id,
        name: product.name,
        isVegetarian: product.isVegetarian,
        category: product.productCategory?.name ?? null,
        ingredientCount: product.goods.length,
        lastPrice: lastPrice === null || lastPrice === undefined ? null : Number(lastPrice),
        // `cost` et `lastPrice` sont désormais tous deux en **centimes** :
        // `lastPrice - cost` est une marge juste, ce qu'elle n'était pas.
        // L'arrondi vient des quantités fractionnaires des recettes.
        cost: cost === null ? null : Math.round(cost),
      }
    })
    return serialize(summaries)
  }

  async ingredients({ params, serialize }: HttpContext) {
    const { lines } = await loadIngredientLines(params.id)

    const withPrices = await Promise.all(
      lines.map(async (line) => {
        const good = await Good.query()
          .where('id', line.id)
          .preload('suppliers')
          .preload('category')
          .firstOrFail()
        const batches = await loadBatchesWithRemaining(good.id, true)
        const stockQty = batches.reduce((sum, b) => sum + b.remainingQty, 0)
        return {
          ...line,
          brand: good.brand,
          category: good.category?.name ?? null,
          unitPrice: minSupplierPrice(good),
          stockQty,
        }
      })
    )
    return serialize(withPrices)
  }

  async recipePdf({ params, request, response }: HttpContext) {
    const { productName, isVegetarian, description, recipe, lines } = await loadIngredientLines(
      params.id
    )
    const eventId = request.qs().eventId as string | undefined
    let plannedQty: number | null = null
    if (eventId) {
      const row = await db
        .from('event_products')
        .where('event_id', eventId)
        .where('product_id', params.id)
        .select('quantity')
        .first()
      plannedQty = row ? Number(row.quantity) : null
    }
    const buffer = await pdfService.generateFromHtml(
      buildRecipeHtml({ productName, isVegetarian, description, recipe, lines, plannedQty }),
      {
        footerTemplate: printFooterTemplate(
          'Instantané généré automatiquement — non mis à jour après impression.'
        ),
      }
    )
    response.header('Content-Type', 'application/pdf')
    response.header('Content-Disposition', `inline; filename="fiche-recette-${params.id}.pdf"`)
    return response.send(buffer)
  }
}
