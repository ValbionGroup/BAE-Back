import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * La double authentification TOTP. Deux tables, et surtout **pas** de colonnes sur
 * `users`, pour trois raisons :
 *
 * 1. `confirmed_at IS NULL` dit en une colonne « inscription commencée, secret pas
 *    encore actif ». Sur `users`, il faudrait deux colonnes ou deux secrets pour
 *    exprimer la même chose, et le login devrait savoir laquelle croire.
 * 2. Le secret n'entre jamais dans `UserSchema`, donc il est hors de portée du
 *    `this.pick(this.resource, [...])` de `UserTransformer` : aucun ajout distrait
 *    à cette liste ne peut le faire fuiter vers `/account/profile`.
 * 3. Reprendre une inscription abandonnée devient un simple remplacement de ligne.
 *
 * `secret` est le chiffré AES-256-GCM d'`encryption.encrypt()`, pas une empreinte :
 * un secret TOTP doit rester réversible pour être vérifiable. Le chiffrement ne
 * protège donc pas contre un serveur compromis, seulement contre une fuite de la
 * base seule — sauvegarde, dump de réplica.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('user_two_factor', (table) => {
      table.increments('id')
      // `unique` et non une simple référence : un compte n'a qu'un secret. La
      // contrainte est ce qui rend l'upsert de reprise d'inscription sûr.
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.text('secret').notNullable()
      table.timestamp('confirmed_at', { useTz: true }).nullable()
      /**
       * Le dernier pas TOTP accepté (`timeStep` au sens de la RFC 6238), repassé à
       * `otplib` en `afterTimeStep` pour qu'il refuse tout pas déjà consommé.
       * Sans ce compteur, un code lu par-dessus l'épaule resterait utilisable
       * pendant sa fenêtre — que la tolérance de dérive d'horloge porte à une
       * minute et demie.
       */
      table.integer('last_used_counter').nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })

    this.schema.createTable('two_factor_recovery_codes', (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      /**
       * HMAC-SHA256 hexadécimal clé par `APP_KEY`, et non une empreinte scrypt :
       * une empreinte scrypt ne s'indexe pas, donc vérifier un code imposerait de
       * charger les dix lignes et d'exécuter jusqu'à dix scrypt — des centaines de
       * millisecondes sur un endpoint que l'attaquant choisit de marteler. Un KDF
       * mémoire-dur n'apporte d'ailleurs rien ici : ce sont des sorties de CSPRNG,
       * pas des mots de passe humains, donc il n'y a aucun dictionnaire à ralentir.
       * La clé, elle, est ce qui rend une fuite de la base seule inexploitable.
       *
       * ⚠️ Conséquence : roter `APP_KEY` invalide tous les codes de secours.
       */
      table.string('code_digest', 64).notNullable()
      table.timestamp('used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true })
      // Sert la recherche en une passe indexée *et* interdit un doublon au sein
      // d'un même lot de dix.
      table.unique(['user_id', 'code_digest'])
    })
  }

  async down() {
    this.schema.dropTable('two_factor_recovery_codes')
    this.schema.dropTable('user_two_factor')
  }
}
