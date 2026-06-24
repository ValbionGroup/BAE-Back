import factory from '@adonisjs/lucid/factories'
import Member from '#models/member'
import { UserFactory } from '#database/factories/user_factory'
import { RoleFactory } from '#database/factories/role_factory'

export const MemberFactory = factory
  .define(Member, async ({ faker }) => {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      roleId: null,
    }
  })
  .before('create', async (builder, member, ctx) => {
    const requestedBelongsTo = (builder as any).withBelongsToRelations as
      | undefined
      | Array<{ name: string }>
    const willCreateUserViaRelation = requestedBelongsTo?.some(
      (relation) => relation.name === 'user'
    )

    if (willCreateUserViaRelation) {
      return
    }

    const user = await UserFactory.useCtx(ctx).create()
    member.id = user.id
    member.$setRelated('user', user)
  })
  .relation('user', () => UserFactory)
  .relation('role', () => RoleFactory)
  .build()
