import { PRESENCE_TOMORROW } from '#services/presence_reminder_service'
import { NotifyPresenceBase } from './notify_presence_pending.js'

/**
 * Fichier séparé, comme les deux autres : Adonis ne découvre qu'**une** commande
 * par fichier, via l'export par défaut. Une seconde classe dans un même fichier
 * serait simplement introuvable, sans erreur.
 */
export default class NotifyPresenceTomorrow extends NotifyPresenceBase {
  static commandName = 'notify:presence-tomorrow'
  static description = 'Rappelle la veille leur poste aux membres ayant répondu présent'

  protected kind = PRESENCE_TOMORROW
  protected defaultDays = 1
}
