import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Client from '#models/client'
import Subscription from '#models/subscription'
import ApiException from '#exceptions/api_exception'
import { updateClientValidator } from '#validators/client'
import { activityOf } from '#services/client_activity_service'
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
  /** Dérivé du claim `ecole`, en lecture seule comme `promotion`. */
  school: string | null
  registeredAt: string
  note: string | null
  noteAuthor: string | null
  noteWrittenAt: string | null
  /**
   * Écrite par l'adhérent depuis sa page profil, et en **lecture seule** ici :
   * `updateClientValidator` ne la connaît pas. À ne pas confondre avec `note`
   * juste au-dessus, qui est ce que le bureau écrit sur lui.
   */
  preparationNote: string | null
  subscriptions: SubscriptionView[]
  preOrderCount: number
  spentCents: number
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
      // Avoir un compte client et être adhérent sont deux choses : le compte
      // naît de la connexion EirbConnect, l'adhésion d'une cotisation. Ceux-ci
      // ont l'un sans l'autre — la maquette les appelait « externes », ce qui
      // décrivait une provenance et non l'absence d'adhésion.
      withoutSubscription: rows.filter((row) => row.status === 'none').length,
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
    const activity = await activityOf(client.id)

    const detail: ClientDetail = {
      ...toRow(client, views),
      school: client.school,
      registeredAt: client.registeredAt.toISODate()!,
      note: client.note,
      noteAuthor: client.noteAuthor?.fullName ?? null,
      noteWrittenAt: client.noteWrittenAt ? client.noteWrittenAt.toISO() : null,
      preparationNote: client.preparationNote,
      subscriptions: views,
      preOrderCount: activity.preOrderCount,
      spentCents: activity.spentCents,
    }
    return serialize(detail)
  }

  async update({ params, request, auth, serialize }: HttpContext) {
    const payload = await request.validateUsing(updateClientValidator)
    const client = await Client.query().where('id', params.id).preload('user').first()

    if (!client) {
      throw new ApiException('E_CLIENT_NOT_FOUND', 'Adhérent introuvable.', 404)
    }

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

    await client.delete()
    return response.noContent()
  }
}
