import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Remonte `first_name` / `last_name` de `members` vers `users`.
 *
 * Une personne peut être membre du BAE **et** cliente (elle travaille certains
 * soirs et précommande les autres) : les deux appartenances sont indépendantes,
 * et chacune est une table d'extension partageant la clé primaire de `users`.
 * Laisser le nom sur `members` obligerait `clients` à porter le sien, donc à
 * stocker deux fois le nom de la même personne, avec deux valeurs qui divergent
 * dès la première correction de faute de frappe.
 *
 * Les colonnes sont **nullables** sur `users` alors qu'elles étaient
 * `notNullable` sur `members` : un compte créé par inscription directe n'a pas
 * encore de nom, et il ne s'en invente pas un.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.string('first_name').nullable()
      table.string('last_name').nullable()
    })

    // Recopie avant la suppression, et par le query builder plutôt qu'un
    // `UPDATE … FROM` : la syntaxe de mise à jour jointe n'est pas la même en
    // Postgres et en MySQL, et les deux connexions sont configurées.
    this.defer(async (db) => {
      const members = await db.from('members').select('id', 'first_name', 'last_name')
      for (const member of members) {
        await db
          .from('users')
          .where('id', member.id)
          .update({ first_name: member.first_name, last_name: member.last_name })
      }
    })

    this.schema.alterTable('members', (table) => {
      table.dropColumn('first_name')
      table.dropColumn('last_name')
    })
  }

  async down() {
    this.schema.alterTable('members', (table) => {
      table.string('first_name').nullable()
      table.string('last_name').nullable()
    })

    this.defer(async (db) => {
      const users = await db
        .from('users')
        .select('id', 'first_name', 'last_name')
        .whereNotNull('first_name')
      for (const user of users) {
        await db
          .from('members')
          .where('id', user.id)
          .update({ first_name: user.first_name, last_name: user.last_name })
      }
    })

    this.schema.alterTable('users', (table) => {
      table.dropColumn('first_name')
      table.dropColumn('last_name')
    })
  }
}
