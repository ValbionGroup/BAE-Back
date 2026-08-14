import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'job_eligible_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('job_id').unsigned().references('id').inTable('jobs').onDelete('CASCADE')
      table.integer('member_id').unsigned().references('id').inTable('members').onDelete('CASCADE')

      table.primary(['job_id', 'member_id'])

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
