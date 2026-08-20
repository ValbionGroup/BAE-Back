import { SubscriptionSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import FastPass from '#models/fast_pass'
import Transaction from '#models/transaction'

/**
 * ⚠️ Clé primaire composite `(user_id, fast_pass_id, subscribed_at)`.
 *
 * Un renouvellement **crée une ligne**, il n'en modifie jamais une : c'est ce
 * qui donne l'historique des cotisations gratuitement. Lucid ne sait pas
 * adresser une clé composite (`find`, `findOrFail`, `save` sur une instance
 * relue) — passer par `Subscription.query()` avec les trois `where`, et par
 * `db.table('subscriptions').insert()` pour créer.
 */
export default class Subscription extends SubscriptionSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => FastPass)
  declare fastPass: BelongsTo<typeof FastPass>

  @belongsTo(() => Transaction)
  declare transaction: BelongsTo<typeof Transaction>
}
