import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { RestockFactory } from '#database/factories/restock_factory'
import Supplier from '#models/supplier'
import Member from '#models/member'

/**
 * Réutilise les enseignes et les membres déjà semés au lieu d'en fabriquer de
 * nouveaux à chaque exécution.
 *
 * `SupplierFactory.createMany(5)` et `MemberFactory.createMany(5)` créaient
 * chacun cinq lignes fictives supplémentaires à chaque `db:seed` — exactement
 * le même défaut de rejouabilité que l'ancien `supplier_seeder.ts` avant sa
 * réécriture, et la cause directe de la dérive observée sur `suppliers`
 * (58 → 68 → 78 en trois relances successives). Un restock n'a besoin que
 * d'un fournisseur et d'un membre existants pour être crédible ; il n'a pas à
 * en créer de nouveaux à chaque passage.
 *
 * Les restocks eux-mêmes (`RestockFactory.createMany(10)`) restent générés à
 * chaque exécution : ce n'est pas ce qui a été signalé, et les rendre
 * idempotents demanderait une clé métier qu'un restock n'a pas naturellement
 * (aucune colonne ne l'identifie de façon stable). Hors périmètre ici.
 */
export default class extends BaseSeeder {
  async run() {
    const suppliers = await Supplier.all()
    const members = await Member.all()

    if (suppliers.length === 0) {
      throw new Error('RestockSeeder: no suppliers found. Run supplier_seeder first!')
    }
    if (members.length === 0) {
      throw new Error('RestockSeeder: no members found. Run member_seeder first!')
    }

    await RestockFactory.merge(
      Array.from({ length: 10 }, (_, index) => ({
        supplierId: suppliers[index % suppliers.length].id,
        memberId: members[index % members.length].id,
      }))
    ).createMany(10)
  }
}
