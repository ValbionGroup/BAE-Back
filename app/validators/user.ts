import vine from '@vinejs/vine'
import { emailRule } from '#validators/rules'

/**
 * ⚠️ `password` reste un `vine.string()` nu, sans longueur minimale : le
 * contraindre empêcherait les porteurs d'un ancien mot de passe de se connecter,
 * donc de le changer.
 */
export const loginValidator = vine.create({
  email: emailRule(),
  password: vine.string(),
})
