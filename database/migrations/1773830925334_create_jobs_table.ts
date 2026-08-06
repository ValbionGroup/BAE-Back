import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'jobs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('name').notNullable()
      table.string('description').nullable()
      // Keep in sync with `DEFAULT_JOB_PERIOD` in `app/services/matching_service.ts` —
      // a migration cannot import it, so this comment is the searchable link between
      // the SQL default and the JS default used by JobsController and JobFactory.
      table.enum('type', ['before', 'during', 'after']).notNullable().defaultTo('during')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
