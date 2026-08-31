import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { TwoFactorState } from '#services/two_factor_service'
import TelegramLinkTransformer from '#transformers/telegram_link_transformer'

const NO_TWO_FACTOR: TwoFactorState = {
  twoFactorEnabled: false,
  twoFactorConfirmedAt: null,
  recoveryCodesRemaining: 0,
}

export default class UserTransformer extends BaseTransformer<User> {
  constructor(
    resource: User,
    private readonly twoFactor: TwoFactorState = NO_TWO_FACTOR
  ) {
    super(resource)
  }

  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'casId', 'email', 'createdAt', 'updatedAt']),
      hasPassword: this.resource.password !== null,
      telegram: TelegramLinkTransformer.transform(this.resource),
      ...this.twoFactor,
    }
  }
}
