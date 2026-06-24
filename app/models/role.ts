import { RoleSchema } from '#database/schema'
import { hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Permission from '#models/permission'
import Member from '#models/member'

export default class Role extends RoleSchema {
  @manyToMany(() => Permission, {
    pivotTable: 'roles_permissions',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'permission_id',
    localKey: 'id',
    relatedKey: 'permission',
    pivotTimestamps: {
      createdAt: 'created_at',
      updatedAt: false,
    },
  })
  declare permissions: ManyToMany<typeof Permission>

  @hasMany(() => Member)
  declare members: HasMany<typeof Member>
}
