import transmit from '@adonisjs/transmit/services/main'
import { middleware } from '#start/kernel'
import { registerOrdersChannel } from '#services/orders_realtime'

/**
 * Flux temps réel (SSE).
 *
 * ⚠️ **`__transmit/events` n'est volontairement pas gardé par `auth()`.** Le flux
 * est ouvert par l'API navigateur `EventSource`, qui **ne peut pas porter
 * d'en-tête personnalisé** — or toute l'authentification de BAE passe par
 * `Authorization: Bearer`. Un flux nu ne transporte cependant rien : aucun
 * message n'y circule tant qu'aucun abonnement n'a été accordé.
 *
 * La barrière est donc sur `__transmit/subscribe` et `__transmit/unsubscribe`,
 * qui sont des requêtes HTTP ordinaires et portent bien l'en-tête. S'y ajoute
 * l'autorisation par canal (`registerOrdersChannel`), qui exige `order:read`.
 *
 * Si cela s'avérait insuffisant, le repli documenté est un `eventSourceFactory`
 * personnalisé côté client (via `@microsoft/fetch-event-source`) capable
 * d'envoyer le jeton sur le flux lui-même.
 */
transmit.registerRoutes((route) => {
  if (route.getPattern() === '__transmit/events') return
  route.use(middleware.auth())
})

registerOrdersChannel()
