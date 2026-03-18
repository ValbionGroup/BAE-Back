import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { type AccessToken, DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Log from "#models/log";
import {hasMany, manyToMany} from "@adonisjs/lucid/orm";
import type {HasMany, ManyToMany} from "@adonisjs/lucid/types/relations";
import FastPass from "#models/fast_pass";

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  static accessTokens = DbAccessTokensProvider.forModel(User)
  declare currentAccessToken?: AccessToken

  @hasMany(() => Log)
  declare logs: HasMany<typeof Log>

  @manyToMany(() => FastPass, {
    pivotTable: 'subscriptions'
  })
  declare fastPasses: ManyToMany<typeof FastPass>
}
