import type { HttpContext } from '@adonisjs/core/http'
import {
  findPreOrder,
  listPreOrders,
  listSubscriptions,
  preOrderQr,
} from '#services/account_purchase_service'

export default class AccountPurchasesController {
  async preOrders({ auth, serialize }: HttpContext) {
    return serialize(await listPreOrders(auth.getUserOrFail().id))
  }

  async preOrder({ auth, params, serialize }: HttpContext) {
    return serialize(await findPreOrder(auth.getUserOrFail().id, Number(params.id)))
  }

  async preOrderQr({ auth, params, serialize }: HttpContext) {
    return serialize(await preOrderQr(auth.getUserOrFail().id, Number(params.id)))
  }

  async subscriptions({ auth, serialize }: HttpContext) {
    return serialize(await listSubscriptions(auth.getUserOrFail().id))
  }
}
