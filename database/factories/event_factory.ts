import factory from '@adonisjs/lucid/factories'
import Event from '#models/event'
import { DateTime } from 'luxon'

/**
 * L'état d'une soirée **se déduit de sa date** — il n'a jamais rien eu
 * d'aléatoire.
 *
 * Le tirage `arrayElement(['scheduled', 'ongoing', 'completed'])` qui vivait ici
 * a coûté deux bugs bien réels en dev : sept soirées `ongoing` simultanées, dont
 * la plus ancienne captait la caisse et la vue live en permanence
 * (`EventsStore.activeEvent` prend la plus ancienne des ouvertes) ; et une
 * soirée `completed` datée de **2027**, sans menu ni commande, que le bilan
 * désignait comme « la dernière soirée clôturée » — d'où un bilan à zéro.
 */
function statusOf(date: DateTime): 'scheduled' | 'ongoing' | 'completed' {
  const today = DateTime.now().startOf('day')
  const day = date.startOf('day')

  if (day < today) return 'completed'
  if (day.equals(today)) return 'ongoing'
  return 'scheduled'
}

export const EventFactory = factory
  .define(Event, async ({ faker }) => {
    const date = DateTime.fromJSDate(faker.date.future())

    return {
      name: faker.company.catchPhrase(),
      description: faker.lorem.paragraph(),
      date,
      status: statusOf(date),
    }
  })
  .build()
