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

  /*
  |----------------------------------------------------------
  | SSO — OIDC (EirbConnect en production, Keycloak local en dev)
  |----------------------------------------------------------
  */
  // Les endpoints ne sont **pas** à écrire à la main : ils se découvrent depuis
  // l'issuer, via `/.well-known/openid-configuration`.
  // Adresse **publique** : c'est celle que suit le navigateur, et celle que le
  // claim `iss` doit porter.
  KEYCLOAK_ISSUER: Env.schema.string({ format: 'url', tld: false }),
  // Chemin **serveur → IdP**, quand il diffère du public : API en conteneur,
  // réseau interne. Seules les requêtes sortantes du serveur y sont réécrites.
  // Vide quand les deux adresses coïncident.
  KEYCLOAK_INTERNAL_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  KEYCLOAK_CLIENT_ID: Env.schema.string(),
  KEYCLOAK_CLIENT_SECRET: Env.schema.string(),
  KEYCLOAK_CALLBACK_URL: Env.schema.string({ format: 'url', tld: false }),
  // ⚠️ Développement uniquement : autorise l'échange sur `http://`. En production
  // cela annulerait la protection du transport — ne jamais l'y activer.
  KEYCLOAK_ALLOW_INSECURE: Env.schema.boolean.optional(),

  // Destinations résolues **côté serveur**. Ne jamais accepter d'URL de retour en
  // paramètre : ce serait une redirection ouverte offerte à qui veut hameçonner.
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
})
