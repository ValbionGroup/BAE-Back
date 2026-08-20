import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Le fait métier, global et unique. `subject_type`/`subject_id` est
 * volontairement **sans clé étrangère** : le sujet peut disparaître (une soirée
 * annulée) sans effacer la trace qu'un rappel est parti — un CASCADE ici
 * rouvrirait la porte au double envoi.
 */
export default class extends BaseSchema {
  protected tableName = 'activity_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('actor_id').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.string('verb').notNullable()
      table.string('subject_type').notNullable()
      table.integer('subject_id').notNullable()
      table.jsonb('payload').notNullable().defaultTo('{}')
      table.timestamp('occurred_at', { useTz: true }).notNullable()
      table.index(['subject_type', 'subject_id'])
      table.index(['verb'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
