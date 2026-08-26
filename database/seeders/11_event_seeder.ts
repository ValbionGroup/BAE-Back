import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import { EventFactory } from '#database/factories/event_factory'

/**
 * Un étalement **déterministe** dans le temps, et non dix dates au hasard.
 *
 * Le cycle de vie d'une soirée ne s'observe pas sur des données aléatoires : il
 * faut au moins une soirée clôturée à regarder au bilan, et une soirée du jour
 * à piloter et à encaisser. Dix soirées futures ne donnent ni l'une ni l'autre,
 * et l'ancien tirage aléatoire de `status` en donnait sept ouvertes à la fois.
 */
export default class extends BaseSeeder {
  async run() {
    const at = (day: DateTime) => day.set({ hour: 19, minute: 30, second: 0, millisecond: 0 })

    // Celle que `soiree/bilan` ouvre par défaut, faute de paramètre de route.
    await EventFactory.merge({
      name: 'Soirée de rentrée',
      date: at(DateTime.now().minus({ days: 7 })),
      status: 'completed',
    }).create()

    // Celle que `EventsStore.activeEvent` désigne : vue live et caisse.
    await EventFactory.merge({
      name: 'Soirée du jour',
      date: at(DateTime.now()),
      status: 'ongoing',
    }).create()

    // Le reste est à venir : le factory en déduit `scheduled` tout seul.
    await EventFactory.createMany(8)
  }
}
