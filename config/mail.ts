import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'
import { LogTransport } from '#mails/log_transport'

/**
 * Deux mailers, et le défaut est `log`.
 *
 * ⚠️ Aucun SMTP n'est encore fourni (c'est une demande externe en attente), donc
 * exiger `SMTP_HOST` empêcherait l'application de démarrer en développement. Le
 * mailer `log` s'appuie sur le `jsonTransport` de Nodemailer : il sérialise le
 * message et ne touche pas au réseau — la file se vide, rien ne part.
 *
 * Le jour où les identifiants arrivent : `MAIL_MAILER=smtp` dans `.env`, plus les
 * trois variables SMTP. Aucun code à changer.
 */
const mailConfig = defineConfig({
  default: env.get('MAIL_MAILER'),

  from: {
    address: env.get('MAIL_FROM_ADDRESS'),
    name: env.get('MAIL_FROM_NAME'),
  },

  globals: {
    brandName: 'BAE',
  },

  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST', 'localhost'),
      port: env.get('SMTP_PORT', 587),
      auth:
        env.get('SMTP_USERNAME') === undefined
          ? undefined
          : {
              type: 'login',
              user: env.get('SMTP_USERNAME')!,
              pass: env.get('SMTP_PASSWORD')!,
            },
    }),

    log: () => new LogTransport(),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
