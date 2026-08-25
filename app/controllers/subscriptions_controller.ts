import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Client from '#models/client'
import FastPass from '#models/fast_pass'
import Subscription from '#models/subscription'
import Transaction from '#models/transaction'
import ApiException from '#exceptions/api_exception'
import { createSubscriptionValidator } from '#validators/subscription'
import { toView } from '#services/subscription_service'

export default class SubscriptionsController {
  /**
   * Un renouvellement **ajoute une ligne**, il n'en modifie aucune : la clé
   * primaire est `(user_id, fast_pass_id, subscribed_at)`, et c'est ce qui
   * donne l'historique des cotisations sans table supplémentaire.
   */
  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(createSubscriptionValidator)
    // `vine.date()` rend déjà un `DateTime` Luxon dans ce dépôt, pas un `Date`.
    const subscribedAt = payload.subscribedAt ?? DateTime.now()

    const created = await db.transaction(async (trx) => {
      const client = await Client.query({ client: trx }).where('id', payload.userId).first()
      if (!client) {
        throw new ApiException('E_CLIENT_NOT_FOUND', 'Adhérent introuvable.', 404)
      }

      const fastPass = await FastPass.query({ client: trx }).where('id', payload.fastPassId).first()
      if (!fastPass) {
        throw new ApiException('E_FAST_PASS_NOT_FOUND', 'Formule introuvable.', 404)
      }

      const duplicate = await Subscription.query({ client: trx })
        .where('userId', payload.userId)
        .where('fastPassId', payload.fastPassId)
        .where('subscribedAt', subscribedAt.toSQL()!)
        .first()
      if (duplicate) {
        throw new ApiException(
          'E_SUBSCRIPTION_ALREADY_EXISTS',
          'Cette cotisation est déjà enregistrée à cette date.',
          409
        )
      }

      const transaction = payload.payment
        ? await Transaction.create(
            { amount: payload.payment.amount, type: payload.payment.type },
            { client: trx }
          )
        : null

      // Insertion directe : Lucid n'adresse pas une clé primaire composite, et
      // `Subscription.create()` tenterait de relire la ligne par un `id` absent.
      await trx.table('subscriptions').insert({
        user_id: payload.userId,
        fast_pass_id: payload.fastPassId,
        subscribed_at: subscribedAt.toSQL(),
        transaction_id: transaction?.id ?? null,
        created_at: DateTime.now().toSQL(),
        updated_at: DateTime.now().toSQL(),
      })

      return { subscribedAt }
    })

    const subscription = await Subscription.query()
      .where('userId', payload.userId)
      .where('fastPassId', payload.fastPassId)
      .where('subscribedAt', created.subscribedAt.toSQL()!)
      .preload('fastPass')
      .preload('transaction')
      .firstOrFail()

    return serialize(toView(subscription))
  }

  async destroy({ request, params, response }: HttpContext) {
    const subscribedAt = request.qs().subscribedAt
    if (typeof subscribedAt !== 'string' || subscribedAt === '') {
      throw new ApiException(
        'E_VALIDATION_ERROR',
        '`subscribedAt` est requis : il fait partie de la clé de la souscription.',
        422
      )
    }

    const parsed = DateTime.fromISO(subscribedAt)
    if (!parsed.isValid) {
      throw new ApiException('E_VALIDATION_ERROR', '`subscribedAt` n’est pas une date ISO.', 422)
    }

    const result = await db
      .from('subscriptions')
      .where('user_id', params.userId)
      .where('fast_pass_id', params.fastPassId)
      .where('subscribed_at', parsed.toSQL()!)
      .delete()

    // Knex type `delete()` en `any[]` alors qu'il rend le nombre de lignes.
    const deleted = Number(result)

    if (deleted === 0) {
      throw new ApiException('E_SUBSCRIPTION_NOT_FOUND', 'Cotisation introuvable.', 404)
    }

    return response.noContent()
  }
}
