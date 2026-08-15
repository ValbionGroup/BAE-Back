import transmit from '@adonisjs/transmit/services/main'
import { middleware } from '#start/kernel'
import { registerOrdersChannel } from '#services/orders_realtime'

// `__transmit/events` reste non gardé : `EventSource` ne peut pas porter
// d'en-tête, donc pas de Bearer. Le flux nu ne transporte rien sans abonnement,
// et c'est `subscribe`/`unsubscribe` — de vraies requêtes HTTP — qui filtrent.
transmit.registerRoutes((route) => {
  if (route.getPattern() === '__transmit/events') return
  route.use(middleware.auth())
})

registerOrdersChannel()
