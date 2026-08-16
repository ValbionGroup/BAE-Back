import type { HttpContext } from '@adonisjs/core/http'
import { collect, kitchenTicketsFor, setPreOrderStatus } from '#services/pre_order_service'
import { orderStatusValidator } from '#validators/order'
import { broadcastPreOrder } from '#services/orders_realtime'

export default class PreOrdersController {
  async index({ params, serialize }: HttpContext) {
    return serialize(await kitchenTicketsFor(Number(params.id)))
  }

  async setStatus({ params, request, serialize }: HttpContext) {
    const payload = await request.validateUsing(orderStatusValidator)
    const ticket = await setPreOrderStatus(Number(params.id), payload.status)
    broadcastPreOrder(ticket)
    return serialize(ticket)
  }

  /** Remet la commande au client, en totalité. */
  async collect({ params, serialize }: HttpContext) {
    const ticket = await collect(Number(params.id))
    broadcastPreOrder(ticket)
    return serialize(ticket)
  }
}
