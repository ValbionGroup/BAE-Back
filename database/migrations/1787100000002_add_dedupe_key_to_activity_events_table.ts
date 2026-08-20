import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * L'unicité de `notifications` protège d'une double **livraison** du même fait,
 * mais pas de la création de deux faits identiques par deux exécutions du même
 * détecteur — ce sont alors deux `event_id` distincts, que la contrainte ne voit
 * pas. `dedupe_key` porte l'identité métier du rappel — « ce verbe, cette soirée »
 * — et c'est elle qui rend une commande rejouable.
 *
 * Nullable : un fait émis par une action humaine (un ticket ouvert) n'a pas à
 * être dédupliqué, il s'est produit une fois.
 */
export default class extends BaseSchema {
  protected tableName = 'activity_events'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('dedupe_key').nullable().unique()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('dedupe_key')
    })
  }
}
