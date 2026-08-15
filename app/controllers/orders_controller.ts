import type { HttpContext } from '@adonisjs/core/http'
import Member from '#models/member'
import {
  cancel,
  checkout,
  listForEvent,
  sellableForEvent,
  setStatus,
} from '#services/order_service'
import { orderCheckoutValidator, orderStatusValidator } from '#validators/order'
import { broadcastOrder } from '#services/orders_realtime'

export default class OrdersController {
  async index({ params, serialize }: HttpContext) {
    return serialize(await listForEvent(Number(params.id)))
  }

  async store({ params, request, response, serialize, auth }: HttpContext) {
    const payload = await request.validateUsing(orderCheckoutValidator)

    // Qui a pris la commande, à ne pas confondre avec `clientId` (l'acheteur).
    const cashier = auth.user ? await Member.find(auth.user.id) : null

    const order = await checkout(
      Number(params.id),
      payload.lines,
      cashier?.id ?? null,
      payload.clientId ?? null,
      payload.paymentMethod ?? 'cash'
    )

    broadcastOrder('order.created', order)

    response.status(201)
    return serialize(order)
  }

  /** Le stock vu du comptoir. */
  async sellable({ params, serialize }: HttpContext) {
    return serialize(await sellableForEvent(Number(params.id)))
  }

  async setStatus({ params, request, serialize }: HttpContext) {
    const payload = await request.validateUsing(orderStatusValidator)
    const order = await setStatus(Number(params.id), payload.status)

    broadcastOrder(payload.status === 'cancelled' ? 'order.cancelled' : 'order.updated', order)

    return serialize(order)
  }

  /** Transition vers `cancelled` : la ligne reste en base. */
  async destroy({ params, serialize }: HttpContext) {
    const order = await cancel(Number(params.id))

    broadcastOrder('order.cancelled', order)

    return serialize(order)
  }
}
