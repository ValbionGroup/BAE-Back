import type { HttpContext } from '@adonisjs/core/http'
import ApiException from '#exceptions/api_exception'
import Event from '#models/event'
import Member from '#models/member'
import ProductionRun from '#models/production_run'
import { commitProduction, commitReturns, planProduction } from '#services/production_service'

interface ProductionLine {
  productId: number
  productName: string
  plannedQty: number
  producedQty: number
  runs: { id: number; quantity: number; createdAt: string | null }[]
}

function positiveInteger(raw: unknown, label: string): number {
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiException('E_BAD_REQUEST', `${label} doit être un entier supérieur à zéro.`, 400)
  }
  return value
}

export default class ProductionRunsController {
  async index({ params, serialize }: HttpContext) {
    const event = await Event.query().where('id', params.id).preload('products').first()
    if (!event) {
      throw new ApiException('E_EVENT_NOT_FOUND', "Cette soirée n'existe pas.", 404)
    }

    const runs = await ProductionRun.query()
      .where('eventId', event.id)
      .preload('product')
      .orderBy('createdAt', 'asc')

    const byProduct = new Map<number, ProductionLine>()

    for (const product of event.products) {
      byProduct.set(product.id, {
        productId: product.id,
        productName: product.name,
        plannedQty: Number(product.$extras.pivot_quantity),
        producedQty: 0,
        runs: [],
      })
    }

    for (const run of runs) {
      let line = byProduct.get(run.productId)
      // A run is a fact: taking the recipe off the menu does not undo the food
      // that was made, so its line survives with a planned quantity of zero.
      if (!line) {
        line = {
          productId: run.productId,
          productName: run.product?.name ?? '—',
          plannedQty: 0,
          producedQty: 0,
          runs: [],
        }
        byProduct.set(run.productId, line)
      }
      line.producedQty += run.quantity
      line.runs.push({
        id: run.id,
        quantity: run.quantity,
        // `.toISO()` and never the raw Luxon DateTime: the case converter would
        // recurse into its internals (`loc`, `c`, `_zone`).
        createdAt: run.createdAt?.toISO() ?? null,
      })
    }

    return serialize([...byProduct.values()])
  }

  async store({ params, request, auth, serialize }: HttpContext) {
    const productId = positiveInteger(request.input('productId'), 'La recette')
    const quantity = positiveInteger(request.input('quantity'), 'La quantité')
    const dryRun = request.input('dryRun') === true

    if (dryRun) {
      const { lines, shortfalls } = await planProduction(productId, quantity)
      return serialize({ productId, quantity, lines, shortfalls })
    }

    // `members.id` IS `users.id` — the members primary key is a foreign key onto
    // users. Resolved rather than assumed: a user without a member row would
    // otherwise break the foreign key with a 500 instead of recording no author.
    const author = auth.user ? await Member.find(auth.user.id) : null
    const { run, lines } = await commitProduction(
      Number(params.id),
      productId,
      quantity,
      author?.id ?? null
    )

    // 200 and not 201: no controller in this repository answers 201 on a
    // creation — `POST /products` and `POST /vouchers` both return the
    // serialized row with a 200. Diverging would make the API answer two
    // different codes for the same kind of gesture.
    return serialize({ id: run.id, productId, quantity, lines })
  }

  /**
   * Only the lines to credit back travel in the body. Discarding writes nothing
   * — the stock already left at the run — so the screen simply omits the goods
   * the operator throws away.
   */
  async returns({ params, request, serialize }: HttpContext) {
    const raw = request.input('lines')
    if (!Array.isArray(raw)) {
      throw new ApiException('E_BAD_REQUEST', 'Le corps doit porter un tableau `lines`.', 400)
    }

    const lines = raw.map((entry) => ({
      goodId: positiveInteger((entry as Record<string, unknown>)?.goodId, 'La denrée'),
      quantity: Number((entry as Record<string, unknown>)?.quantity),
    }))

    return serialize(await commitReturns(Number(params.id), lines))
  }
}
