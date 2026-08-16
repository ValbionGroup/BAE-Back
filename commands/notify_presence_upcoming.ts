import { PRESENCE_UPCOMING } from '#services/presence_reminder_service'
import { NotifyPresenceBase } from './notify_presence_pending.js'

/**
 * Fichier séparé, et non un second export du précédent : Adonis découvre **une**
 * commande par fichier, via l'export par défaut. Deux classes dans un même
 * fichier n'en exposeraient qu'une, sans erreur — la seconde serait simplement
 * introuvable.
 */
export default class NotifyPresenceUpcoming extends NotifyPresenceBase {
  static commandName = 'notify:presence-upcoming'
  static description = 'Rappelle leur participation aux membres ayant répondu présent'

  protected kind = PRESENCE_UPCOMING
}
