import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'
import { checkout, listForEvent } from '#services/order_service'
import { orderCheckoutValidator } from '#validators/order'

export default class OrdersController {
  async index({ params, serialize }: HttpContext) {
    return serialize(await listForEvent(Number(params.id)))
  }

  async store({ params, request, response, serialize, auth }: HttpContext) {
    const payload = await request.validateUsing(orderCheckoutValidator)

    // Qui a **pris** la commande — à ne pas confondre avec `clientId`, qui est
    // l'acheteur. `auth.user.id` vaut `members.id` (clé primaire partagée), mais
    // on vérifie la ligne : un `users` sans `members` deviendra possible dès que
    // la table `clients` existera.
    const cashier = auth.user ? await Member.find(auth.user.id) : null

    const order = await checkout(
      Number(params.id),
      payload.lines,
      cashier?.id ?? null,
      payload.clientId ?? null
    )

    response.status(201)
    return serialize(order)
  }
}
