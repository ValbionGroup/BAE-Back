import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import SumUpClient from '#services/sumup/sumup_client'

/** Le seul chemin pour obtenir un `reader_id` par l'API. */
export default class SumupReaders extends BaseCommand {
  static commandName = 'sumup:readers'
  static description = 'Liste les lecteurs SumUp appairés, ou en appaire un nouveau'
  static options: CommandOptions = { startApp: true }

  @flags.string({
    description: 'Code affiché sur le Solo (Connections → Wi-Fi → API). Valable 5 minutes.',
  })
  declare pair?: string

  @flags.string({ description: 'Nom donné au lecteur appairé', default: 'Caisse BAE' })
  declare name: string

  async run() {
    const client = await this.app.container.make(SumUpClient)

    if (this.pair) {
      const reader = await client.pairReader(this.pair, this.name)
      this.logger.success(`Lecteur appairé : ${reader.name}`)
      this.logger.info(`SUMUP_READER_ID=${reader.id}`)
      return
    }

    const readers = await client.listReaders()

    if (readers.length === 0) {
      this.logger.warning('Aucun lecteur appairé sur ce compte marchand.')
      this.logger.info('Appairez-en un : node ace sumup:readers --pair=<code affiché sur le Solo>')
      return
    }

    const table = this.ui.table().head(['Identifiant', 'Nom', 'Statut', 'Appareil'])
    for (const reader of readers) {
      table.row([reader.id, reader.name, reader.status, reader.deviceIdentifier ?? '—'])
    }
    table.render()
  }
}
