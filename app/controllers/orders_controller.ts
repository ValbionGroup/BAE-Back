import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'
import { cancel, checkout, listForEvent, setStatus } from '#services/order_service'
import { orderCheckoutValidator, orderStatusValidator } from '#validators/order'

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

  async setStatus({ params, request, serialize }: HttpContext) {
    const payload = await request.validateUsing(orderStatusValidator)
    return serialize(await setStatus(Number(params.id), payload.status))
  }

  /**
   * Annule la commande. La ligne **reste** en base : c'est une transition vers
   * `cancelled`, pas une suppression — la numérotation par soirée en dépend, et
   * une commande encaissée puis rendue doit laisser une trace.
   */
  async destroy({ params, serialize }: HttpContext) {
    return serialize(await cancel(Number(params.id)))
  }
}
