import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`ALTER TABLE transactions DROP CONSTRAINT transactions_type_check`)
    this.schema.raw(
      `ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('cash', 'lydia', 'card'))`
    )
  }

  async down() {
    this.schema.raw(`ALTER TABLE transactions DROP CONSTRAINT transactions_type_check`)
    this.schema.raw(
      `ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('cash', 'lydia'))`
    )
  }
}
