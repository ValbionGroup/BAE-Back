import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { toString as qrToString, toBuffer as qrToBuffer } from 'qrcode'
import app from '@adonisjs/core/services/app'
import JwtService, { type QrTokenPayload } from '#services/jwt_service'

const TYPES = ['identity', 'fast_pass', 'pre_order'] as const
type QrType = (typeof TYPES)[number]

/**
 * Fabrique un QR signé pour éprouver le comptoir sans passer par un téléphone.
 *
 * Les jetons émis par l'API vivent 180 s ; ici la durée est réglable, parce
 * qu'un QR qui meurt entre sa génération et le scan ne teste rien.
 *
 * Réservée au développement : la commande signe une identité avec la clé privée,
 * exactement ce que `GET /account/qr` refuse de faire pour autrui.
 */
export default class QrMake extends BaseCommand {
  static commandName = 'qr:make'
  static description = 'Génère un QR signé (identité, fast pass, retrait de précommande)'

  static options: CommandOptions = { startApp: true }

  @args.string({ description: `Type de QR : ${TYPES.join(' | ')}` })
  declare type: string

  @flags.number({ description: "Identifiant de l'utilisateur (users.id)", default: 1 })
  declare user: number

  @flags.number({ description: 'Identifiant du fast pass (type fast_pass)', default: 1 })
  declare fastPass: number

  @flags.number({ description: 'Identifiant de la précommande (type pre_order)', default: 1 })
  declare preOrder: number

  @flags.number({ description: 'Identifiant de la soirée (type pre_order)', default: 1 })
  declare event: number

  @flags.number({ description: 'Durée de vie du jeton, en secondes', default: 3600 })
  declare ttl: number

  @flags.string({ description: 'Chemin du PNG à écrire', default: 'tmp/qr.png' })
  declare out: string

  async run() {
    if (app.inProduction) {
      this.logger.error('Commande réservée au développement.')
      this.exitCode = 1
      return
    }

    if (!TYPES.includes(this.type as QrType)) {
      this.logger.error(`Type inconnu : ${this.type}. Attendus : ${TYPES.join(', ')}`)
      this.exitCode = 1
      return
    }

    const payload = this.buildPayload(this.type as QrType)
    const token = await new JwtService().generateQrToken(payload, this.ttl)

    const target = resolve(app.makePath(this.out))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, await qrToBuffer(token, { margin: 1, width: 512 }))

    this.logger.log(await qrToString(token, { type: 'terminal', small: true }))
    this.logger.info(`Type    : ${this.type}`)
    this.logger.info(`Charge  : ${JSON.stringify(payload)}`)
    this.logger.info(`Validité: ${this.ttl}s`)
    this.logger.info(`PNG     : ${target}`)
    this.logger.info(`Jeton   : ${token}`)
  }

  private buildPayload(type: QrType): Omit<QrTokenPayload, 'iat' | 'exp'> {
    if (type === 'fast_pass') {
      return { type, userId: this.user, fastPassId: this.fastPass }
    }
    if (type === 'pre_order') {
      return { type, userId: this.user, preOrderId: this.preOrder, eventId: this.event }
    }
    return { type: 'identity', userId: this.user }
  }
}
