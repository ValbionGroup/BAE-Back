import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  DB_HOST: Env.schema.string(),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string(),
  DB_DATABASE: Env.schema.string(),

  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  JWT_PRIVATE_KEY: Env.schema.secret(),
  JWT_PUBLIC_KEY: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the mail package
  |----------------------------------------------------------
  */
  // `log` par défaut : aucun SMTP n'est encore fourni, et l'application doit
  // démarrer sans. Basculer sur `smtp` le jour où les identifiants existent.
  MAIL_MAILER: Env.schema.enum(['smtp', 'log'] as const),
  MAIL_FROM_NAME: Env.schema.string(),
  MAIL_FROM_ADDRESS: Env.schema.string(),
  // ⚠️ Optionnelles à dessein : les rendre requises casserait le démarrage en
  // développement, où le mailer `log` n'a besoin d'aucune d'entre elles.
  SMTP_HOST: Env.schema.string.optional(),
  SMTP_PORT: Env.schema.number.optional(),
  SMTP_USERNAME: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.string.optional(),
})
