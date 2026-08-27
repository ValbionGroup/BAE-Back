import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import { ROLE_PERMISSIONS, type RoleName } from '#database/rbac_catalog'

/**
 * ⚠️ `attach` du seul delta manquant, et non `sync` du catalogue : ce seeder
 * tourne à chaque déploiement (`SEED=true`, cf. `docker-entrypoint.js`), et le
 * bureau règle ses droits en cours de route depuis l'écran Équipe
 * (`PUT /roles/:id/permissions`). Un `sync` ramènerait le catalogue d'usine à
 * chaque montée de version et effacerait ces réglages sans rien dire.
 *
 * Le catalogue reste donc un **plancher** : il fait parvenir aux rôles les
 * permissions qu'un lot vient d'introduire — sans quoi la route nouvelle
 * resterait fermée à tout le monde — mais il ne reprend jamais un droit. Un
 * droit retiré à l'écran alors qu'il figure au catalogue revient au
 * déploiement suivant ; le retirer pour de bon se fait dans `rbac_catalog.ts`.
 */
export default class extends BaseSeeder {
  async run() {
    const roles = await Role.query()
      .whereIn('name', Object.keys(ROLE_PERMISSIONS))
      .preload('permissions')

    for (const role of roles) {
      const held = new Set(role.permissions.map((permission) => permission.permission))
      const missing = ROLE_PERMISSIONS[role.name as RoleName].filter(
        (permission) => !held.has(permission)
      )

      if (missing.length > 0) {
        await role.related('permissions').attach(missing)
      }
    }
  }
}
