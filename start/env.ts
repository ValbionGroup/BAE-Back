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
  MAIL_MAILER: Env.schema.enum(['smtp', 'log'] as const),
  MAIL_FROM_NAME: Env.schema.string(),
  MAIL_FROM_ADDRESS: Env.schema.string(),
  SMTP_HOST: Env.schema.string.optional(),
  SMTP_PORT: Env.schema.number.optional(),
  SMTP_USERNAME: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | SSO — OIDC (EirbConnect en production, Keycloak local en dev)
  |----------------------------------------------------------
  */
  KEYCLOAK_ISSUER: Env.schema.string({ format: 'url', tld: false }),
  KEYCLOAK_INTERNAL_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  KEYCLOAK_CLIENT_ID: Env.schema.string(),
  KEYCLOAK_CLIENT_SECRET: Env.schema.string(),
  KEYCLOAK_CALLBACK_URL: Env.schema.string({ format: 'url', tld: false }),
  KEYCLOAK_ALLOW_INSECURE: Env.schema.boolean.optional(),

  DASHBOARD_URL: Env.schema.string({ format: 'url', tld: false }),
  PUBLIC_APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Domaine du cookie de session. **Optionnel, et vide en développement** : sans
  // lui le cookie est `host-only`, ce qui convient tant que tout tient sur
  // `localhost` (le port n'entre pas dans l'identité d'un cookie).
  //
  // En production les trois origines sont distinctes — `api.`, `dashboard.` et
  // `order.bae.eirb.fr` — et un cookie posé par l'API ne serait alors envoyé par
  // aucun des deux fronts. Il faut y valoir `.bae.eirb.fr`.
  COOKIE_DOMAIN: Env.schema.string.optional(),

  // Remise consentie sur une précommande, en pourcentage du tarif public.
  // Optionnelle : `public_catalog_service` retombe sur 10 %. Elle ne touche pas
  // le tarif de la caisse — elle récompense le fait de commander à l'avance,
  // pas l'achat lui-même.
  PRE_ORDER_DISCOUNT_PERCENT: Env.schema.number.optional(),

  // Réduction **supplémentaire** accordée aux détenteurs d'une adhésion sur
  // leurs précommandes, en points de pourcentage. Optionnelle : le service
  // retombe sur 5 %. C'est un argument de vente de la page Fastpass, donc il
  // vit ici plutôt qu'écrit en dur dans le front.
  FAST_PASS_PRE_ORDER_BONUS_PERCENT: Env.schema.number.optional(),

  // Combien d'heures avant le début d'une soirée les précommandes ferment.
  // Optionnelle : le service retombe sur 12 h. C'est le délai dont la cuisine a
  // besoin pour produire — il se règle donc sans redéploiement.
  PRE_ORDER_CLOSE_LEAD_HOURS: Env.schema.number.optional(),

  // Minutes sans génération de PDF au bout desquelles le navigateur Chromium
  // résident est libéré. Optionnelle : `pdf_service` retombe sur 10.
  //
  // À 0, le navigateur reste ouvert pour la durée de vie du processus. C'est le
  // réglage à choisir si son démarrage à froid coûte, sur la machine visée, plus
  // cher que les quelques centaines de Mio qu'il occupe au repos.
  PDF_BROWSER_IDLE_MINUTES: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Paiement — Lydia
  |----------------------------------------------------------
  */
  LYDIA_DRIVER: Env.schema.enum(['http', 'fake'] as const),
  LYDIA_URL: Env.schema.string({ format: 'url', tld: false }),
  LYDIA_VENDOR_TOKEN: Env.schema.secret(),
  LYDIA_PRIVATE_TOKEN: Env.schema.secret(),
  LYDIA_CALLBACK_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
})
