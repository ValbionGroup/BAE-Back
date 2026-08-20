import { BaseSchema } from '@adonisjs/lucid/schema'

const CHANNELS = ['mail', 'in_app']

export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('event_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('activity_events')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.enum('channel', CHANNELS).notNullable()
      // `null` = en file d'attente. C'est `notify:dispatch` qui l'horodate.
      table.timestamp('sent_at', { useTz: true }).nullable()
      table.timestamp('read_at', { useTz: true }).nullable()

      // ⚠️ Le cœur du lot : l'insertion de cette ligne EST la prise de verrou.
      // Deux crons concurrents — le second reçoit une violation d'unicité et
      // n'envoie rien. Un `if (déjà envoyé) return` lu puis écrit ne protège pas :
      // entre la lecture et l'écriture, un autre processus lit la même absence.
      table.unique(['event_id', 'user_id', 'channel'])
      table.index(['sent_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
