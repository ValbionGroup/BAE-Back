import transmit from '@adonisjs/transmit/services/main'
import { permissionsOfMember } from '#services/rbac_service'
import type { OrderPayload } from '#services/order_service'

/** Un canal par soirée : la cuisine d'un soir n'a rien à voir d'un autre. */
export function ordersChannel(eventId: number | string): string {
  return `events/${eventId}/orders`
}

export type OrderEvent = 'order.created' | 'order.updated' | 'order.cancelled' | 'pre_order.updated'

/**
 * Réutilise `permissionsOfMember`, la résolution qu'emploie déjà
 * `PermissionMiddleware` : rien n'est réécrit, donc rien ne peut diverger.
 * Exportée séparément pour être testée sans ouvrir de flux SSE.
 */
export async function canReadOrders(userId: number | undefined): Promise<boolean> {
  if (userId === undefined) return false
  const granted = await permissionsOfMember(userId)
  return granted.has('order:read')
}

export function registerOrdersChannel(): void {
  transmit.authorize<{ id: string }>(ordersChannel(':id'), async (ctx) => {
    return canReadOrders(ctx.auth.user?.id)
  })
}

/** ⚠️ À n'appeler qu'après le commit : un rollback afficherait une commande fantôme. */
export function broadcastOrder(event: OrderEvent, order: OrderPayload): void {
  if (order.eventId === null || order.eventId === undefined) return
  transmit.broadcast(ordersChannel(order.eventId), { event, order })
}

/** Les précommandes empruntent le canal de leur soirée : la cuisine n'a qu'une file. */
export function broadcastPreOrder(ticket: { eventId: number }): void {
  transmit.broadcast(ordersChannel(ticket.eventId), {
    event: 'pre_order.updated',
    preOrder: ticket as unknown as Record<string, never>,
  })
}
