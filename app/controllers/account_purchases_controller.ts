import type { HttpContext } from '@adonisjs/core/http'
import {
  findPreOrder,
  listPreOrders,
  listSubscriptions,
  preOrderQr,
} from '#services/account_purchase_service'

/**
 * Hors garde d'audience, comme les notifications : ce sont **ses** achats, et un
 * membre en a autant qu'un client. Le filtre de sécurité est le `where user_id`
 * du service, pas une permission — aucune permission ne dirait « les siens ».
 */
export default class AccountPurchasesController {
  async preOrders({ auth, serialize }: HttpContext) {
    return serialize(await listPreOrders(auth.getUserOrFail().id))
  }

  async preOrder({ auth, params, serialize }: HttpContext) {
    return serialize(await findPreOrder(auth.getUserOrFail().id, Number(params.id)))
  }

  /** Le QR de retrait, signé par le serveur et lié à cette précommande. */
  async preOrderQr({ auth, params, serialize }: HttpContext) {
    return serialize(await preOrderQr(auth.getUserOrFail().id, Number(params.id)))
  }

  async subscriptions({ auth, serialize }: HttpContext) {
    return serialize(await listSubscriptions(auth.getUserOrFail().id))
  }
}
