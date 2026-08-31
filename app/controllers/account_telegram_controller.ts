import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import ApiException from '#exceptions/api_exception'
import User from '#models/user'
import TelegramLinkTransformer from '#transformers/telegram_link_transformer'
import TelegramClient from '#services/telegram/telegram_client'
import { issueLinkCode, unlink } from '#services/telegram/telegram_link_service'
import { UNLINKED } from '#services/telegram/telegram_messages'

export default class AccountTelegramController {
  /**
   * Relier suppose de délier d'abord : accepter un second code ferait exister un
   * état « en cours de déménagement » qu'il faudrait décrire à l'écran, pour
   * économiser un clic.
   */
  async store({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    if (user.telegramChatId !== null) {
      throw new ApiException(
        'E_TELEGRAM_ALREADY_LINKED',
        'Ce compte est déjà lié à Telegram. Déliez-le avant d’en lier un autre.',
        409
      )
    }

    return serialize(await issueLinkCode(user.id))
  }

  /**
   * Rend l'état de liaison plutôt qu'un 204 : le front remplace directement le
   * sien avec la réponse, comme il le fait déjà pour `PATCH /account/profile`.
   *
   * L'adieu part hors de toute transaction et sans propager son échec — un bot
   * injoignable ne doit pas empêcher quelqu'un de se délier.
   */
  async destroy({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const previousChatId = await unlink(user.id)

    if (previousChatId !== null) {
      const telegram = await app.container.make(TelegramClient)
      await telegram.sendMessage(previousChatId, UNLINKED).catch(() => undefined)
    }

    const fresh = await User.findOrFail(user.id)
    return serialize(TelegramLinkTransformer.transform(fresh))
  }
}
