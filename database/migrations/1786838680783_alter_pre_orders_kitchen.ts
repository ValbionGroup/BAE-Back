import { BaseSchema } from '@adonisjs/lucid/schema'

const STATUSES = ['pending', 'in_progress', 'ready', 'completed', 'cancelled']

export default class extends BaseSchema {
  protected tableName = 'pre_orders'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Le suivi cuisine. `received_quantity` dit ce qui est physiquement parti ;
      // ce statut dit où en est la préparation. Les deux sont utiles et ne se
      // remplacent pas — même rapport qu'entre `orders.status` et le montant de
      // sa transaction.
      table.string('status').notNullable().defaultTo('pending')

      // L'heure de retrait, choisie par le client sur l'interface publique.
      // Nullable : les précommandes existantes n'en ont pas, et une précommande
      // sans heure se prépare dès l'ouverture plutôt que de sortir de la file.
      //
      // ⚠️ Le pas de 15 min et les bornes horaires sont une règle de **saisie**,
      // à porter par le validateur de création côté public — pas une contrainte
      // de schéma, qui se heurterait aux fuseaux. Cet endpoint n'existe pas
      // encore (§4.3).
      table.timestamp('pickup_at').nullable()
    })

    this.schema.raw(
      `ALTER TABLE pre_orders ADD CONSTRAINT pre_orders_status_check CHECK (status IN (${STATUSES.map((s) => `'${s}'`).join(', ')}))`
    )
  }

  async down() {
    this.schema.raw(`ALTER TABLE pre_orders DROP CONSTRAINT pre_orders_status_check`)
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('status')
      table.dropColumn('pickup_at')
    })
  }
}
