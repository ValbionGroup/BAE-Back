import { BaseSchema } from '@adonisjs/lucid/schema'

const STATUSES = ['open', 'in_progress', 'closed']
const PRIORITIES = ['low', 'normal', 'high']

/**
 * Le helpdesk. Deux tables et non une : un ticket est un objet qui vit et change
 * d'état, un message est un contenu écrit une fois et qu'on ne réécrit pas.
 *
 * `author_id` pointe sur `users` et non `members` : ouvrir un ticket est un geste
 * de personne, et un client de la zone publique aura autant de raisons de le
 * faire qu'un membre du bureau.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('tickets', (table) => {
      table.increments('id')
      table
        .integer('author_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('subject').notNullable()
      table.enum('status', STATUSES).notNullable().defaultTo('open')
      table.enum('priority', PRIORITIES).notNullable().defaultTo('normal')
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      table.index(['status'])
      table.index(['author_id'])
    })

    this.schema.createTable('ticket_messages', (table) => {
      table.increments('id')
      table
        .integer('ticket_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('tickets')
        .onDelete('CASCADE')
      // `SET NULL` et non `CASCADE` : supprimer un compte ne doit pas effacer la
      // conversation, qui appartient au fil autant qu'à son auteur.
      table
        .integer('author_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.text('body').notNullable()
      table.timestamp('created_at', { useTz: true })
      table.index(['ticket_id'])
    })
  }

  async down() {
    this.schema.dropTable('ticket_messages')
    this.schema.dropTable('tickets')
  }
}
