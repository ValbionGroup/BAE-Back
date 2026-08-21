import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

/**
 * Le générateur de `database/schema.ts` masque `password` par une règle nommée sur
 * la colonne, et cette liste est la seule qu'il connaisse. Tout autre secret est
 * donc sérialisé par défaut — un `serialize()` sur la ligne, et il part sur le
 * réseau.
 *
 * Les règles vivent au niveau `columns` et non `tables`, délibérément : ces trois
 * noms ne désignent jamais rien de publiable, quelle que soit la table qui les
 * porte. Une règle globale protège donc aussi les tables qui n'existent pas encore,
 * là où une règle par table devrait être pensée à nouveau chaque fois.
 *
 * ⚠️ Deux pièges du générateur, payés une fois :
 * - une entrée `ColumnInfo` **remplace** le défaut au lieu de le compléter (le
 *   chargeur désactive la fusion dès qu'un `tsType` est présent), donc il faut
 *   fournir `tsType`, `imports` et `decorators` en entier ;
 * - le `| null` des colonnes nullables est ajouté **ensuite** par le générateur :
 *   écrire `'string'`, jamais `'string | null'`, sous peine d'un `string | null | null`.
 */
export default {
  columns: {
    /** Secret TOTP chiffré — cf. `1788000000001_create_user_two_factor_table`. */
    secret: {
      tsType: 'string',
      imports: [],
      decorators: [{ name: '@column', args: { serializeAs: null } }],
    },
    /** Empreinte d'un code de secours à usage unique. */
    code_digest: {
      tsType: 'string',
      imports: [],
      decorators: [{ name: '@column', args: { serializeAs: null } }],
    },
    /** Empreinte d'un jeton de réinitialisation de mot de passe. */
    token_digest: {
      tsType: 'string',
      imports: [],
      decorators: [{ name: '@column', args: { serializeAs: null } }],
    },
  },
} satisfies SchemaRules
