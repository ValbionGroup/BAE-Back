import { BaseMail } from '@adonisjs/mail'

/**
 * Corps en texte brut, délibérément : aucun SMTP n'est encore fourni, donc rien
 * n'a pu être vérifié dans un vrai client de messagerie. Une mise en forme HTML
 * écrite à l'aveugle serait à refaire le jour où on la voit pour la première fois.
 *
 * L'expéditeur n'est pas fixé ici : il vient du bloc `from` de `config/mail.ts`,
 * pour n'avoir qu'un seul endroit à changer.
 */
export class PresenceReminderNotification extends BaseMail {
  constructor(
    private readonly recipient: string,
    private readonly subjectLine: string,
    private readonly lines: readonly string[]
  ) {
    super()
  }

  prepare() {
    this.message.to(this.recipient).subject(this.subjectLine).text(this.lines.join('\n\n'))
  }
}
