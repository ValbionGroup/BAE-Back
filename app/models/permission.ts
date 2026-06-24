import { PermissionSchema } from '#database/schema'
import { manyToMany } from '@adonisjs/lucid/orm'
import Role from '#models/role'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'

export default class Permission extends PermissionSchema {
  public static primaryKey = 'permission'
  public static selfAssignPrimaryKey = true

  @manyToMany(() => Role, {
    pivotTable: 'roles_permissions',
    pivotForeignKey: 'permission_id',
    pivotRelatedForeignKey: 'role_id',
    localKey: 'permission',
    relatedKey: 'id',
    pivotTimestamps: {
      createdAt: 'created_at',
      updatedAt: false,
    },
  })
  declare roles: ManyToMany<typeof Role>
}
