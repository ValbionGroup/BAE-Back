import vine from '@vinejs/vine'
import { emailRule, strongPasswordRule } from '#validators/rules'

export const forgotPasswordValidator = vine.create({
  email: emailRule(),
})

/**
 * Le jeton est du base64url de 32 octets, donc 43 caractères. Les bornes sont
 * larges à dessein : elles écartent le bruit manifeste sans devenir un oracle sur
 * la longueur exacte, et sans casser le jour où `randomToken()` change de taille.
 */
export const resetPasswordValidator = vine.create({
  token: vine.string().minLength(20).maxLength(200),
  password: strongPasswordRule(),
  passwordConfirmation: strongPasswordRule().sameAs('password'),
})
