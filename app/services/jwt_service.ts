import jwtConfig from '#config/jwt'
import { importPKCS8, importSPKI, SignJWT, jwtVerify, type JWTPayload } from 'jose'

export type QrTokenPayload = JWTPayload &
  (
    | {
        type: 'fast_pass'
        userId: number
        fastPassId: number
      }
    | {
        type: 'pre_order'
        userId: number
        preOrderId: number
        eventId: number
      }
  )

export default class JwtService {
  readonly #algorithm = jwtConfig.algorithm

  async sign(payload: JWTPayload, options: { expiresIn?: string | number } = {}): Promise<string> {
    const privateKey = await importPKCS8(jwtConfig.privateKey, this.#algorithm)

    const builder = new SignJWT(payload).setProtectedHeader({ alg: this.#algorithm }).setIssuedAt()

    if (options.expiresIn !== undefined) {
      builder.setExpirationTime(options.expiresIn)
    }

    return builder.sign(privateKey)
  }

  async verify<T extends JWTPayload = JWTPayload>(token: string): Promise<T> {
    const publicKey = await importSPKI(jwtConfig.publicKey, this.#algorithm)
    const { payload } = await jwtVerify<T>(token, publicKey, {
      algorithms: [this.#algorithm],
    })
    return payload
  }

  async generateQrToken(
    data: Omit<QrTokenPayload, keyof JWTPayload>,
    ttlSeconds = 60
  ): Promise<string> {
    return this.sign(data, { expiresIn: ttlSeconds })
  }

  async verifyQrToken(token: string): Promise<QrTokenPayload> {
    return this.verify<QrTokenPayload>(token)
  }
}
