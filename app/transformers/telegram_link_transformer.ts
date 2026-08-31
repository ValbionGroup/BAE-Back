import { BaseTransformer } from '@adonisjs/core/transformers'
import type User from '#models/user'

/**
 * L'état de liaison tel que son porteur a le droit de le lire : `linked` est
 * **dérivé** de `telegramChatId`, qui ne sort jamais — c'est l'adresse
 * d'émission du bot.
 */
export default class TelegramLinkTransformer extends BaseTransformer<User> {
  toObject() {
    return {
      handle: this.resource.telegramHandle,
      linked: this.resource.telegramChatId !== null,
      linkedAt: this.resource.telegramLinkedAt?.toISO() ?? null,
    }
  }
}
