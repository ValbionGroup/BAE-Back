import vine from '@vinejs/vine'
import { emailRule, passwordRule } from '#validators/rules'

export const signupValidator = vine.create({
  email: emailRule().unique({ table: 'users', column: 'email' }),
  password: passwordRule(),
  passwordConfirmation: passwordRule().sameAs('password'),
})

export const loginValidator = vine.create({
  email: emailRule(),
  password: vine.string(),
})
