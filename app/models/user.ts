import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { errors as authErrors } from '@adonisjs/auth'
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
    pivotForeignKey: 'user_id',
    pivotRelatedForeignKey: 'fast_pass_id',
    pivotColumns: ['subscribed_at'],
    pivotTimestamps: true,
  })
  declare fastPasses: ManyToMany<typeof FastPass>

  @hasOne(() => Member, { foreignKey: 'id', localKey: 'id' })
  declare member: HasOne<typeof Member>

  @hasMany(() => PreOrder)
  declare preOrders: HasMany<typeof PreOrder>

  /**
   * ⚠️ Pas de relation inverse vers `Client` ni `Subscription` ici, bien que la
   * symétrie avec `member` l'appelle : le cycle d'imports que ça crée
   * (`user` → `client` → `user`) fait abandonner l'inférence de types de Lucid
   * **globalement**. `ExtractModelRelations` cesse alors de résoudre jusque
   * dans `logs_controller`, et l'erreur ne désigne jamais la relation fautive.
   * Passer par `Client.query().where('id', userId)`.
   */
  get fullName(): string | null {
    const parts = [this.firstName, this.lastName].filter((part) => part !== null && part !== '')
    return parts.length > 0 ? parts.join(' ') : null
  }

  /**
   * Passage obligé du formulaire mot-de-passe. Il existe parce que
   * `verifyCredentials` du mixin `withAuthFinder` ne garde **pas** le cas d'une
   * colonne `password` nulle : il appelle `verifyPassword`, documenté comme levant
   * une `RuntimeException` sur `null`. Un compte né du SSO produisait donc un
   * **500**, quand un compte inexistant produit un 401.
   *
   * ⚠️ L'écart de statut n'était pas qu'un plantage : c'était un **oracle
   * d'énumération de comptes**. D'où le choix de rendre l'échec rigoureusement
   * identique — même exception, et même `hash.make()` inutile que le mixin
   * exécute pour un utilisateur introuvable, afin de ne pas non plus créer un
   * oracle temporel.
   *
   * Le garde vit ici, et non dans le contrôleur, pour qu'un futur appelant de
   * l'authentification par mot de passe ne puisse pas le contourner par oubli.
   */
  static async verifyPasswordCredentials(email: string, password: string): Promise<User> {
    const existing = await User.findBy('email', email)

    if (existing !== null && existing.password === null) {
      await hash.make(password)
      throw new authErrors.E_INVALID_CREDENTIALS('Invalid user credentials')
    }

    return User.verifyCredentials(email, password)
  }
}
