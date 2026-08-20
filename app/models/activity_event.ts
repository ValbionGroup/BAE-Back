import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/**
 * Le fait métier. Le fil d'activité de l'accueil en est la lecture globale ;
 * `Notification` en est la projection vers une personne.
 */
export default class ActivityEvent extends BaseModel {
  static table = 'activity_events'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare actorId: number | null

  @column()
  declare verb: string

  @column()
  declare subjectType: string

  @column()
  declare subjectId: number

  @column({
    prepare: (value: Record<string, unknown>) => JSON.stringify(value),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare payload: Record<string, unknown>

  @column.dateTime()
  declare occurredAt: DateTime

  /** Identité métier d'un fait rejouable — voir la migration qui l'ajoute. */
  @column()
  declare dedupeKey: string | null
}
