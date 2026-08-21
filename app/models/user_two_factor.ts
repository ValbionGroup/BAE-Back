import { UserTwoFactorSchema } from '#database/schema'

export default class UserTwoFactor extends UserTwoFactorSchema {
  static table = 'user_two_factor'
}
