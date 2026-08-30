import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Telegram devient un troisième canal de livraison, à côté de `mail` et `in_app`.
 *
 * `table.enum()` produit en Postgres un varchar et une contrainte CHECK, pas un
 * type natif : élargir la liste impose donc de la recréer en SQL brut.
 */
const CHANNEL_CHECK = 'notifications_channel_check'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`ALTER TABLE notifications DROP CONSTRAINT ${CHANNEL_CHECK}`)
    this.schema.raw(
      `ALTER TABLE notifications ADD CONSTRAINT ${CHANNEL_CHECK}
         CHECK (channel IN ('mail', 'in_app', 'telegram'))`
    )
  }

  /**
   * Les livraisons Telegram violeraient la contrainte restaurée : il faut les
   * retirer avant de la rétrécir. Le fait reste dans `activity_events`, seule sa
   * projection vers ce canal disparaît.
   */
  async down() {
    this.schema.raw(`DELETE FROM notifications WHERE channel = 'telegram'`)
    this.schema.raw(`ALTER TABLE notifications DROP CONSTRAINT ${CHANNEL_CHECK}`)
    this.schema.raw(
      `ALTER TABLE notifications ADD CONSTRAINT ${CHANNEL_CHECK}
         CHECK (channel IN ('mail', 'in_app'))`
    )
  }
}
