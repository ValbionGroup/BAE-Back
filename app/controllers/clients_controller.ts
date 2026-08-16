import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import string from '@adonisjs/core/helpers/string'
import Client from '#models/client'
import User from '#models/user'
import Subscription from '#models/subscription'
import ApiException from '#exceptions/api_exception'
import { createClientValidator, updateClientValidator } from '#validators/client'
import {
  EXPIRY_WARN_WINDOW_DAYS,
  type MembershipStatus,
  type SubscriptionView,
  currentOf,
  daysUntil,
  membershipNumber,
  toView,
} from '#services/subscription_service'

interface ClientRow {
  id: number
  membershipNumber: string
  name: string | null
  email: string
  promotion: string | null
  status: MembershipStatus
  expiresAt: string | null
  daysUntilExpiry: number | null
}

interface ClientDetail extends ClientRow {
  phone: string | null
  registeredAt: string
  note: string | null
  noteAuthor: string | null
  noteWrittenAt: string | null
  subscriptions: SubscriptionView[]
}

async function subscriptionsByUser(userIds: number[]): Promise<Map<number, SubscriptionView[]>> {
  const byUser = new Map<number, SubscriptionView[]>()
  if (userIds.length === 0) return byUser

  const rows = await Subscription.query()
    .whereIn('userId', userIds)
    .preload('fastPass')
    .preload('transaction')

  for (const row of rows) {
    const list = byUser.get(row.userId) ?? []
    list.push(toView(row))
    byUser.set(row.userId, list)
  }
  return byUser
}

function toRow(client: Client, views: readonly SubscriptionView[]): ClientRow {
  const current = currentOf(views)
  return {
    id: client.id,
    membershipNumber: membershipNumber(client.id, client.registeredAt, views.length > 0),
    name: client.user.fullName,
    email: client.user.email,
    promotion: client.promotion,
    status: current ? current.status : 'none',
    expiresAt: current ? current.expiresAt : null,
    daysUntilExpiry: current ? daysUntil(DateTime.fromISO(current.expiresAt)) : null,
  }
}

export default class ClientsController {
  async index({ serialize }: HttpContext) {
    const clients = await Client.query().preload('user')
    const byUser = await subscriptionsByUser(clients.map((client) => client.id))

    const rows = clients.map((client) => toRow(client, byUser.get(client.id) ?? []))
    rows.sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, 'fr'))
    return serialize(rows)
  }

  /**
   * Les compteurs sont dérivés des **mêmes** lignes que la liste, et non d'un
   * `COUNT` séparé : deux requêtes qui interprètent « à jour » chacune de leur
   * côté finissent par afficher « 287 à jour » au-dessus de 290 lignes vertes.
   */
  async summary({ serialize }: HttpContext) {
    const clients = await Client.query().preload('user')
    const byUser = await subscriptionsByUser(clients.map((client) => client.id))
    const rows = clients.map((client) => toRow(client, byUser.get(client.id) ?? []))

    return serialize({
      total: rows.length,
      upToDate: rows.filter((row) => row.status === 'active').length,
      expired: rows.filter((row) => row.status === 'expired').length,
      // « Externes » au sens de la maquette : enregistré, jamais cotisé.
      external: rows.filter((row) => row.status === 'none').length,
      expiringSoon: rows.filter(
        (row) =>
          row.status === 'active' &&
          row.daysUntilExpiry !== null &&
          row.daysUntilExpiry <= EXPIRY_WARN_WINDOW_DAYS
      ).length,
    })
  }

  async show({ params, serialize }: HttpContext) {
    const client = await Client.query()
      .where('id', params.id)
      .preload('user')
      .preload('noteAuthor')
      .first()

    if (!client) {
      throw new ApiException('E_CLIENT_NOT_FOUND', 'Adhérent introuvable.', 404)
    }

    const byUser = await subscriptionsByUser([client.id])
    const views = byUser.get(client.id) ?? []
    views.sort((a, b) => b.subscribedAt.localeCompare(a.subscribedAt))

    const detail: ClientDetail = {
      ...toRow(client, views),
      phone: client.phone,
      registeredAt: client.registeredAt.toISODate()!,
      note: client.note,
      noteAuthor: client.noteAuthor?.fullName ?? null,
      noteWrittenAt: client.noteWrittenAt ? client.noteWrittenAt.toISO() : null,
      subscriptions: views,
    }
    return serialize(detail)
  }

  /**
   * Crée le compte s'il n'existe pas, puis la ligne `clients`. Un membre du BAE
   * qui prend sa carte réutilise donc son compte : les deux appartenances sont
   * indépendantes et partagent la clé primaire de `users`.
   */
  async store({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(createClientValidator)

    const client = await db.transaction(async (trx) => {
      const existingUser = await User.query({ client: trx }).where('email', payload.email).first()

      if (existingUser) {
        existingUser.firstName = payload.firstName
        existingUser.lastName = payload.lastName
        existingUser.useTransaction(trx)
        await existingUser.save()

        const already = await Client.query({ client: trx }).where('id', existingUser.id).first()
        if (already) {
          throw new ApiException(
            'E_CLIENT_ALREADY_EXISTS',
            'Cette personne est déjà adhérente.',
            409
          )
        }
      }

      const account =
        existingUser ??
        (await User.create(
          {
            email: payload.email,
            // Un client s'authentifie par le SSO (§4.4), jamais par mot de
            // passe — mais la colonne est `notNullable`. Une valeur aléatoire
            // vaut donc « pas de mot de passe utilisable » en attendant.
            password: string.random(32),
            firstName: payload.firstName,
            lastName: payload.lastName,
          },
          { client: trx }
        ))

      return Client.create(
        {
          id: account.id,
          phone: payload.phone ?? null,
          promotion: payload.promotion ?? null,
          registeredAt: payload.registeredAt ?? DateTime.now(),
        },
        { client: trx }
      )
    })

    await client.load('user')
    return serialize(toRow(client, []))
  }

  async update({ params, request, auth, serialize }: HttpContext) {
    const payload = await request.validateUsing(updateClientValidator)
    const client = await Client.query().where('id', params.id).preload('user').first()

    if (!client) {
      throw new ApiException('E_CLIENT_NOT_FOUND', 'Adhérent introuvable.', 404)
    }

    if (payload.firstName !== undefined) client.user.firstName = payload.firstName
    if (payload.lastName !== undefined) client.user.lastName = payload.lastName
    if (payload.firstName !== undefined || payload.lastName !== undefined) {
      await client.user.save()
    }

    if ('phone' in payload) client.phone = payload.phone ?? null
    if ('promotion' in payload) client.promotion = payload.promotion ?? null

    // La note porte son auteur et sa date : l'écran les affiche
    // (« Sarah K. · 12 jan. »), et les recalculer à l'affichage serait faux.
    if ('note' in payload) {
      client.note = payload.note ?? null
      client.noteAuthorId = payload.note ? auth.getUserOrFail().id : null
      client.noteWrittenAt = payload.note ? DateTime.now() : null
    }

    await client.save()

    const byUser = await subscriptionsByUser([client.id])
    return serialize(toRow(client, byUser.get(client.id) ?? []))
  }

  async destroy({ params, response }: HttpContext) {
    const client = await Client.query().where('id', params.id).first()
    if (!client) {
      throw new ApiException('E_CLIENT_NOT_FOUND', 'Adhérent introuvable.', 404)
    }

    // Supprime l'appartenance publique, pas le compte : la personne peut être
    // membre du BAE par ailleurs, et ses souscriptions passées restent
    // l'histoire de la trésorerie.
    await client.delete()
    return response.noContent()
  }
}
