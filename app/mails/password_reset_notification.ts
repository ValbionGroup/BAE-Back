import { BaseMail } from '@adonisjs/mail'

/**
 * Corps en texte brut, comme `PresenceReminderNotification` et pour la même
 * raison : aucun SMTP n'est encore fourni, donc un gabarit HTML serait écrit
 * sans jamais avoir été vu dans une vraie boîte — et réécrit le jour où il l'est.
 *
 * L'expéditeur n'est pas fixé ici : il vient du bloc `from` de `config/mail.ts`.
 */
export class PasswordResetNotification extends BaseMail {
  constructor(
    private readonly recipient: string,
    private readonly resetUrl: string,
    private readonly ttlMinutes: number
  ) {
    super()
  }

  prepare() {
    this.message
      .to(this.recipient)
      .subject('Réinitialisation de votre mot de passe BAE')
      .text(
        [
          'Bonjour,',
          `Vous avez demandé à réinitialiser votre mot de passe. Ouvrez ce lien, valable ${this.ttlMinutes} minutes :`,
          this.resetUrl,
          "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
        ].join('\n\n')
      )
  }
}
