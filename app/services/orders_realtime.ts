import transmit from '@adonisjs/transmit/services/main'
import { permissionsOfMember } from '#services/rbac_service'
import type { OrderPayload } from '#services/order_service'

/** Un canal par soirée : la cuisine d'un soir n'a rien à voir d'un autre. */
export function ordersChannel(eventId: number | string): string {
  return `events/${eventId}/orders`
}

export type OrderEvent = 'order.created' | 'order.updated' | 'order.cancelled'

/**
 * Autorisation du canal des commandes.
 *
 * ⚠️ **C'est le point qui justifie Transmit plutôt qu'un WebSocket monté à la
 * main.** Le rappel reçoit le `HttpContext` complet, donc `ctx.auth.user` : la
 * vérification réutilise `permissionsOfMember`, exactement la résolution
 * qu'emploie `PermissionMiddleware`. Rien n'est réécrit, donc rien ne peut
 * diverger — contrairement au service front actuel, qui fait
 * `initialize(user.id)` en faisant aveuglément confiance au client (§9.10).
 *
 * Exportée séparément pour être éprouvée sans ouvrir de flux SSE.
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

/**
 * Diffuse un changement à tous les postes branchés sur la soirée.
 *
 * ⚠️ **À n'appeler qu'après le commit**, jamais depuis l'intérieur d'une
 * transaction : un rollback laisserait sinon les écrans afficher une commande
 * qui n'existe pas.
 */
export function broadcastOrder(event: OrderEvent, order: OrderPayload): void {
  if (order.eventId === null || order.eventId === undefined) return
  transmit.broadcast(ordersChannel(order.eventId), { event, order })
}
