import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export type NotificationChannel = 'mail' | 'in_app' | 'telegram'

/**
 * La livraison d'un `ActivityEvent` à une personne, sur un canal. `channel` fait
 * partie de la contrainte d'unicité : la même personne peut légitimement recevoir
 * le même fait par mail *et* dans l'application, jamais deux fois par le même.
 */
export default class Notification extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare eventId: number

  @column()
  declare userId: number

  @column()
  declare channel: NotificationChannel

  @column.dateTime()
  declare sentAt: DateTime | null

  @column.dateTime()
  declare readAt: DateTime | null
}
