import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { type AccessToken, DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Log from '#models/log'
import { hasMany, manyToMany, hasOne } from '@adonisjs/lucid/orm'
import type { HasMany, HasOne, ManyToMany } from '@adonisjs/lucid/types/relations'
import FastPass from '#models/fast_pass'
import Member from '#models/member'
import PreOrder from '#models/pre_order'

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  static accessTokens = DbAccessTokensProvider.forModel(User)
  declare currentAccessToken?: AccessToken

  @hasMany(() => Log)
  declare logs: HasMany<typeof Log>

  @manyToMany(() => FastPass, {
    pivotTable: 'subscriptions',
  })
  declare fastPasses: ManyToMany<typeof FastPass>

  @hasOne(() => Member, { foreignKey: 'id', localKey: 'id' })
  declare member: HasOne<typeof Member>

  @hasMany(() => PreOrder)
  declare preOrders: HasMany<typeof PreOrder>
}
