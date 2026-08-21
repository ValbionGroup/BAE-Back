import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * `hasPassword` est dérivé, jamais la colonne : `users.password` porte un hash
 * bcrypt et n'a rien à faire dans une charge utile. Le front en a besoin parce
 * que la colonne est nullable depuis le SSO — un compte provisionné par Keycloak
 * n'a aucun mot de passe à changer, et l'écran Sécurité doit pouvoir taire son
 * panneau plutôt que d'offrir un formulaire qui n'aboutira jamais.
 */
export default class UserTransformer extends BaseTransformer<User> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'casId', 'email', 'createdAt', 'updatedAt']),
      hasPassword: this.resource.password !== null,
    }
  }
}
