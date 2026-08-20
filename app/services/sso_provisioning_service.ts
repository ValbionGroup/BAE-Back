import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Client from '#models/client'
import Member from '#models/member'
import type { SsoClaims } from '#services/oidc_service'
import { formatCursus } from '#services/cursus'

export const SSO_APPS = ['dashboard', 'public'] as const
export type SsoApp = (typeof SSO_APPS)[number]

export function isSsoApp(value: unknown): value is SsoApp {
  return typeof value === 'string' && (SSO_APPS as readonly string[]).includes(value)
}

export type ResolutionOutcome =
  { status: 'ok'; user: User } | { status: 'not-a-member'; user: User }

async function resolveUser(claims: SsoClaims): Promise<User> {
  let user = await User.findBy('keycloakSub', claims.subject)

  if (user === null) {
    user = await User.findBy('casId', claims.casId)
    if (user !== null) {
      user.keycloakSub = claims.subject
    }
  }

  if (user === null) {
    user = new User()
    user.casId = claims.casId
    user.keycloakSub = claims.subject
    user.email = claims.email
    user.password = null
  }

  if (user.email !== claims.email) user.email = claims.email
  if (claims.firstName !== null) user.firstName = claims.firstName
  if (claims.lastName !== null) user.lastName = claims.lastName

  await user.save()
  return user
}

export async function provision(app: SsoApp, claims: SsoClaims): Promise<ResolutionOutcome> {
  return db.transaction(async () => {
    const user = await resolveUser(claims)

    if (app === 'dashboard') {
      const member = await Member.find(user.id)
      return member === null
        ? ({ status: 'not-a-member', user } as const)
        : ({ status: 'ok', user } as const)
    }

    const existing = await Client.find(user.id)
    if (existing === null) {
      await Client.create({
        id: user.id,
        phone: null,
        promotion: formatCursus(claims.degree),
        school: claims.school,
        registeredAt: DateTime.now(),
        note: null,
        noteAuthorId: null,
      })
    } else {
      if (claims.degree !== null) existing.promotion = formatCursus(claims.degree)
      if (claims.school !== null) existing.school = claims.school
      await existing.save()
    }

    return { status: 'ok', user } as const
  })
}
