import { PermissionSchema } from '#database/schema'
import {manyToMany} from "@adonisjs/lucid/orm";
import Role from "#models/role";
import type {ManyToMany} from "@adonisjs/lucid/types/relations";

export default class Permission extends PermissionSchema {
  @manyToMany(() => Role, {
    pivotTable: 'roles_permissions',
  })
  declare roles: ManyToMany<typeof Role>
}
