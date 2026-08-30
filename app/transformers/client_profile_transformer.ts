import { BaseTransformer } from '@adonisjs/core/transformers'
import type Client from '#models/client'

/**
 * La ligne `clients` telle que son propriétaire a le droit de la lire : sans `note`
 * (elle est au bureau) ni `telegramChatId` (adresse d'émission du bot).
 */
export default class ClientProfileTransformer extends BaseTransformer<Client> {
  toObject() {
    return {
      ...this.pick(this.resource, ['phone', 'promotion', 'school', 'preparationNote']),
      registeredAt: this.resource.registeredAt?.toISODate() ?? null,
      telegram: {
        handle: this.resource.telegramHandle,
        linked: this.resource.telegramChatId !== null,
        linkedAt: this.resource.telegramLinkedAt?.toISO() ?? null,
      },
    }
  }
}
