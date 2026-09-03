import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DEMO_ONLY } from '#database/seeder_environment'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Client from '#models/client'
import FastPass from '#models/fast_pass'
import Transaction from '#models/transaction'
import User from '#models/user'

/**
 * Peuple la page Adhérents avec les quatre états qu'elle sait afficher — à jour,
 * bientôt expirée, expirée, jamais cotisé.
 *
 * ⚠️ `fast_passes.duration` est un nombre d'**années**, pas de jours : `expiryOf`
 * fait `plus({ years })`. Ces formules portaient `duration: 365` — écrit pour
 * dire « un an », lu comme trois cent soixante-cinq ans, donc jamais expiré.
 * Aucun des quatre états n'était réellement représenté.
 *
 * `price` est en **centimes**, comme toute valeur monétaire.
 */
const ANNUAL_FORMULAS = [
  { label: 'Adhésion 2025-2026', price: 1500, duration: 1 },
  { label: 'Adhésion 2024-2025', price: 1200, duration: 1 },
] as const

interface SeedClient {
  email: string
  firstName: string
  lastName: string
  phone: string | null
  promotion: string | null
  /** Jours écoulés depuis chaque souscription, de la plus ancienne à la plus récente. */
  subscribedDaysAgo: number[]
  note?: string
}

const CLIENTS: SeedClient[] = [
  {
    email: 'c.renard@etu.ec.fr',
    firstName: 'Camille',
    lastName: 'Renard',
    phone: '06 24 31 88 02',
    promotion: '2A · Alt.',
    subscribedDaysAgo: [740, 370, 10],
    note: 'Allergie noix · à signaler en cuisine. Préfère payer en Lydia.',
  },
  {
    email: 'a.picard@etu.ec.fr',
    firstName: 'Antoine',
    lastName: 'Picard',
    phone: '06 11 22 33 44',
    promotion: '3A · Init.',
    subscribedDaysAgo: [30],
  },
  {
    email: 's.lemaire@etu.ec.fr',
    firstName: 'Sofia',
    lastName: 'Lemaire',
    phone: null,
    promotion: '4A · Alt.',
    subscribedDaysAgo: [400],
  },
  {
    email: 'm.bensaid@etu.ec.fr',
    firstName: 'Marwane',
    lastName: 'Bensaïd',
    phone: '07 55 66 77 88',
    promotion: '1A · Init.',
    // 350 jours sur 365 : expire dans 15 jours, donc « expiration < 30j ».
    subscribedDaysAgo: [350],
  },
  {
    email: 'e.vasseur@etu.ec.fr',
    firstName: 'Élise',
    lastName: 'Vasseur',
    phone: null,
    promotion: '5A · Alt.',
    subscribedDaysAgo: [720, 355],
  },
  {
    email: 'p.aubry@gmail.com',
    firstName: 'Pierre',
    lastName: 'Aubry',
    phone: null,
    promotion: 'Ext. (invité)',
    subscribedDaysAgo: [],
  },
  {
    email: 'i.dubreuil@etu.ec.fr',
    firstName: 'Inès',
    lastName: 'Dubreuil',
    phone: '06 98 76 54 32',
    promotion: '2A · Alt.',
    subscribedDaysAgo: [5],
  },
  {
    email: 'yasmine.k@gmail.com',
    firstName: 'Yasmine',
    lastName: 'Kaced',
    phone: null,
    promotion: 'Alumni',
    subscribedDaysAgo: [800, 430],
  },
]

export default class extends BaseSeeder {
  static environment = DEMO_ONLY

  async run() {
    // La note interne s'affiche avec son auteur : sans lui, l'écran montre
    // « Auteur inconnu » et la vérification ne prouve rien.
    const noteAuthor = await User.findBy('email', 'admin@bae.test')

    const formulas: FastPass[] = []
    for (const formula of ANNUAL_FORMULAS) {
      formulas.push(
        await FastPass.firstOrCreate(
          { label: formula.label },
          { ...formula, description: 'Adhésion annuelle au BAE.' }
        )
      )
    }

    for (const seed of CLIENTS) {
      // Le seeder simule ce que fera le callback EirbConnect : c'est le seul
      // chemin de création d'un compte client. `casId` matérialise cette
      // provenance, et `ClientsController.store` refuse un compte qui n'en a
      // pas — sans lui, ces adhérents de démonstration seraient irrecevables.
      const user = await User.firstOrCreate(
        { email: seed.email },
        {
          email: seed.email,
          password: 'adherent-de-demonstration',
          casId: `eirbconnect-demo-${seed.email}`,
          firstName: seed.firstName,
          lastName: seed.lastName,
        }
      )

      if (user.casId === null) {
        user.casId = `eirbconnect-demo-${seed.email}`
        await user.save()
      }

      const registeredAt = DateTime.now().minus({
        days: Math.max(...seed.subscribedDaysAgo, 60),
      })

      await Client.updateOrCreate(
        { id: user.id },
        {
          id: user.id,
          promotion: seed.promotion,
          registeredAt,
          note: seed.note ?? null,
          noteAuthorId: seed.note ? (noteAuthor?.id ?? null) : null,
          noteWrittenAt: seed.note ? DateTime.now().minus({ days: 20 }) : null,
        }
      )

      await db.from('subscriptions').where('user_id', user.id).delete()

      for (const [index, daysAgo] of seed.subscribedDaysAgo.entries()) {
        // Les dates vont de la plus ancienne à la plus récente : la dernière
        // porte la formule de l'année en cours, les précédentes la précédente.
        const isCurrent = index === seed.subscribedDaysAgo.length - 1
        const formula = isCurrent ? formulas[0] : formulas[1]
        const transaction = await Transaction.create({
          amount: formula.price,
          type: index % 2 === 0 ? 'lydia' : 'cash',
        })

        await db.table('subscriptions').insert({
          user_id: user.id,
          fast_pass_id: formula.id,
          subscribed_at: DateTime.now().minus({ days: daysAgo }).toSQL(),
          transaction_id: transaction.id,
          created_at: DateTime.now().toSQL(),
          updated_at: DateTime.now().toSQL(),
        })
      }
    }
  }
}
