import { BaseTransformer } from '@adonisjs/core/transformers'
import type Client from '#models/client'

/**
 * La ligne `clients` telle que son propriétaire a le droit de la lire : sans `note`,
 * qui est celle du bureau sur lui. La liaison Telegram n'est plus ici — elle a
 * remonté sur `users`, cf. `TelegramLinkTransformer`.
 */
export default class ClientProfileTransformer extends BaseTransformer<Client> {
  toObject() {
    return {
      ...this.pick(this.resource, ['phone', 'promotion', 'school', 'preparationNote']),
      registeredAt: this.resource.registeredAt?.toISODate() ?? null,
    }
  }
}
