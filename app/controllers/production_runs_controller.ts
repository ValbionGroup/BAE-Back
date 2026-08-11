import type { HttpContext } from '@adonisjs/core/http'
import ApiException from '#exceptions/api_exception'
import Member from '#models/member'
import { commitProduction, planProduction } from '#services/production_service'

function positiveInteger(raw: unknown, label: string): number {
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiException('E_BAD_REQUEST', `${label} doit être un entier supérieur à zéro.`, 400)
  }
  return value
}

export default class ProductionRunsController {
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
}
