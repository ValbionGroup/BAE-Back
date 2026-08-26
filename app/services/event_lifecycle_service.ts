import ApiException from '#exceptions/api_exception'
import type Event from '#models/event'

/**
 * Le garde-fou de la clôture, côté serveur.
 *
 * L'interface ferme déjà la caisse et vide la vue live dès que la soirée passe
 * `completed` — `EventsStore.activeEvent` n'en veut plus. Mais ce n'était
 * qu'une politesse d'écran : rien n'empêchait un onglet resté ouvert, un
 * rejeu, ou un appel direct d'écrire des ventes sur une soirée dont le bilan
 * est déjà tiré et les points déjà consolidés.
 *
 * Appelé là où la soirée est **déjà chargée et verrouillée** dans la
 * transaction (`priceCart`, `commitProduction`), pour ne pas payer une requête
 * de plus et pour que la décision soit prise sous le même verrou que l'écriture
 * qu'elle autorise.
 *
 * ⚠️ Volontairement **pas** appliqué aux retours de production
 * (`/production-returns`) : ils font partie de la clôture, et une correction
 * après coup doit rester possible.
 */
export function assertEventOpen(event: Event): void {
  if (event.status !== 'completed') return

  throw new ApiException(
    'E_EVENT_CLOSED',
    `« ${event.name} » est clôturée : plus rien ne peut y être rattaché.`,
    409
  )
}
