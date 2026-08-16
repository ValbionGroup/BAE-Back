import { MailResponse } from '@adonisjs/mail'
import type { MailTransportContract, NodeMailerMessage } from '@adonisjs/mail/types'
import logger from '@adonisjs/core/services/logger'

/**
 * Transport de développement : n'ouvre aucune connexion et journalise ce qui
 * serait parti.
 *
 * Il existe parce qu'**aucun SMTP n'est encore fourni** (demande externe en
 * attente) et que le reste de la chaîne — détection, file, vidange — doit être
 * exécutable et vérifiable sans lui. Nodemailer sait faire la même chose avec
 * `jsonTransport: true`, mais l'option n'est pas dans le type `SMTPConfig`
 * d'AdonisJS : la déclarer par un cast masquerait l'intention là où vingt lignes
 * typées la disent.
 *
 * ⚠️ Ne jamais le laisser par défaut en production : il **avale** les messages
 * sans rien signaler. `MAIL_MAILER=smtp` est ce qui bascule.
 */
export class LogTransport implements MailTransportContract {
  async send(message: NodeMailerMessage): Promise<MailResponse> {
    const recipients = (message.to ?? []).map((to) =>
      typeof to === 'string' ? to : (to.address ?? '')
    )

    logger.info(
      { to: recipients, subject: message.subject },
      'mail non envoyé — transport `log` actif'
    )

    const messageId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    return new MailResponse(messageId, { from: String(message.from ?? ''), to: recipients }, {
      messageId,
    } as never)
  }

  async close(): Promise<void> {}
}
