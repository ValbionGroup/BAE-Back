import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Recopiée, et non importée de `#validators/catalog`. Une migration décrit
 * l'état de la base **au jour où elle est écrite** : la brancher sur une
 * constante vivante ferait muter le passé à la première valeur ajoutée.
 */
const STORAGE_METHODS = ['fridge', 'freezer', 'dry', 'cellar'] as const

/**
 * Le mode de conservation d'une denrée — « Signaler la méthode de stockage »
 * (CDC P1, doc 2 §18.2).
 *
 * **Nullable, et sans backfill.** La table est déjà peuplée et rien ne permet
 * de deviner où se range une denrée existante : un défaut à `'dry'` affirmerait
 * que les surgelés se conservent à sec. L'absence de valeur se lit « pas encore
 * signalé », ce qui est vrai, et se corrige denrée par denrée depuis le panneau
 * de détail des stocks.
 */
export default class extends BaseSchema {
  protected tableName = 'goods'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // `table.enum()` sans `useNative` rend une colonne `text` + un CHECK
      // inline (cf. `1786818947391`), pas un type enum Postgres. Élargir la
      // liste plus tard se fera donc en remplaçant la contrainte.
      table.enum('storage_method', STORAGE_METHODS).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('storage_method')
    })
  }
}
