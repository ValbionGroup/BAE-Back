import vine from '@vinejs/vine'
import { strongPasswordRule } from '#validators/rules'

/**
 * ⚠️ `currentPassword` est un `vine.string()` nu, sans longueur minimale, et c'est
 * délibéré — `loginValidator.password` l'est pour la même raison. Un mot de passe
 * déjà en base peut précéder n'importe quelle règle : le contraindre ici
 * empêcherait son porteur de le changer, c'est-à-dire exactement la personne que
 * la règle prétend aider.
 */
export const changePasswordValidator = vine.create({
  currentPassword: vine.string(),
  password: strongPasswordRule(),
  passwordConfirmation: strongPasswordRule().sameAs('password'),
})
