import type { HttpContext } from '@adonisjs/core/http'
import {
  collect,
  kitchenTicketsFor,
  setPickupAt,
  setPreOrderStatus,
} from '#services/pre_order_service'
import { orderStatusValidator, preOrderPickupValidator } from '#validators/order'
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

  /**
   * Pose, déplace ou retire le créneau de retrait.
   *
   * Diffusé comme un changement de statut : la file de la cuisine trie sur
   * l'heure de retrait, donc déplacer un créneau réordonne l'écran de tout le
   * monde.
   */
  async setPickup({ params, request, serialize }: HttpContext) {
    const payload = await request.validateUsing(preOrderPickupValidator)
    const ticket = await setPickupAt(
      Number(params.id),
      payload.pickupAt === null ? null : payload.pickupAt.toISO()
    )
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
