import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import Product from '#models/product'
import ApiException from '#exceptions/api_exception'
import { minSupplierPrice } from '#services/pricing_service'
import { primaryCategoryName } from '#services/product_category_service'
import { eventProductValidator, eventProductUpdateValidator } from '#validators/event_product'
import { buildShoppingList } from '#services/shopping_list_service'
import { buildShoppingListHtml } from '#services/print/print_shopping_list'
import { printFooterTemplate } from '#services/print/print_layout'
import { pdfService } from '#services/pdf_service'

interface MenuLinePayload {
  productId: number
  name: string
  isVegetarian: boolean
  quantity: number
  price: number
  unitCost: number | null
  totalCost: number | null
  category: string | null
}

function unitCostOf(product: Product): number | null {
  let cost = 0
  for (const good of product.goods) {
    const price = minSupplierPrice(good)
    if (price === null) return null
    cost += Number(good.$extras.pivot_quantity) * price
  }
  return cost
}

function toMenuLine(product: Product): MenuLinePayload {
  const quantity = Number(product.$extras.pivot_quantity)
  const unitCost = unitCostOf(product)
  return {
    productId: product.id,
    name: product.name,
    isVegetarian: product.isVegetarian ?? false,
    quantity,
    price: Number(product.$extras.pivot_price),
    unitCost,
    totalCost: unitCost === null ? null : unitCost * quantity,
    category: primaryCategoryName(product),
  }
}

async function loadEventWithMenu(id: string): Promise<Event> {
  const event = await Event.query()
    .where('id', id)
    .preload('products', (products) => {
      products.preload('goods', (goods) => {
        goods.preload('suppliers')
        goods.preload('category')
      })
      products.orderBy('name')
    })
    .first()

  if (!event) {
    throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
  }
  return event
}

async function lastSalePrice(productId: number): Promise<number> {
  const row = await db
    .from('event_products')
    .join('events', 'events.id', 'event_products.event_id')
    .where('event_products.product_id', productId)
    .orderBy('events.date', 'desc')
    .select('event_products.price')
    .first()

  return row ? Number(row.price) : 0
}

async function reloadLine(eventId: string, productId: number): Promise<MenuLinePayload> {
  const event = await loadEventWithMenu(eventId)
  const line = event.products.find((product) => product.id === productId)
  if (!line) {
    throw new ApiException('E_PRODUCT_NOT_FOUND', "Cette recette n'existe pas.", 404)
  }
  return toMenuLine(line)
}

export default class EventProductsController {
  async index({ params, serialize }: HttpContext) {
    const event = await loadEventWithMenu(params.id)
    return serialize(event.products.map(toMenuLine))
  }

  async store({ params, request, serialize }: HttpContext) {
    const event = await loadEventWithMenu(params.id)
    const payload = await request.validateUsing(eventProductValidator)

    const product = await Product.find(payload.productId)
    if (!product) {
      throw new ApiException('E_PRODUCT_NOT_FOUND', "Cette recette n'existe pas.", 404)
    }

    if (event.products.some((entry) => entry.id === product.id)) {
      throw new ApiException(
        'E_MENU_LINE_EXISTS',
        'Cette recette est déjà au menu de la soirée.',
        409
      )
    }

    const price = payload.price ?? (await lastSalePrice(product.id))
    await event.related('products').attach({
      [product.id]: { quantity: payload.quantity, price },
    })

    return serialize(await reloadLine(params.id, product.id))
  }

  async update({ params, request, serialize }: HttpContext) {
    const event = await loadEventWithMenu(params.id)
    const productId = Number(params.productId)

    const current = event.products.find((entry) => entry.id === productId)
    if (!current) {
      throw new ApiException(
        'E_PRODUCT_NOT_FOUND',
        "Cette recette n'est pas au menu de cette soirée.",
        404
      )
    }

    const payload = await request.validateUsing(eventProductUpdateValidator)
    // `sync` and not `attach`, which would insert a duplicate; the trailing
    // `false` disables detaching, without which syncing a single row would wipe
    // the rest of the menu.
    await event.related('products').sync(
      {
        [productId]: {
          quantity: payload.quantity ?? Number(current.$extras.pivot_quantity),
          price: payload.price ?? Number(current.$extras.pivot_price),
        },
      },
      false
    )

    return serialize(await reloadLine(params.id, productId))
  }

  async destroy({ params, response }: HttpContext) {
    const event = await loadEventWithMenu(params.id)
    const productId = Number(params.productId)

    if (!event.products.some((entry) => entry.id === productId)) {
      throw new ApiException(
        'E_PRODUCT_NOT_FOUND',
        "Cette recette n'est pas au menu de cette soirée.",
        404
      )
    }

    await event.related('products').detach([productId])
    return response.noContent()
  }

  async shoppingList({ params, serialize }: HttpContext) {
    return serialize(await buildShoppingList(params.id))
  }

  async shoppingListPdf({ params, response }: HttpContext) {
    const list = await buildShoppingList(params.id)
    const buffer = await pdfService.generateFromHtml(buildShoppingListHtml(list), {
      footerTemplate: printFooterTemplate(
        'Instantané généré automatiquement — non mis à jour après impression.'
      ),
    })
    response.header('Content-Type', 'application/pdf')
    response.header('Content-Disposition', `inline; filename="fiche-logistique-${params.id}.pdf"`)
    return response.send(buffer)
  }
}
