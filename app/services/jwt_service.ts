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
    | {
        type: 'identity'
        userId: number
      }
    | {
        type: 'sponsorship_category'
        categoryId: number
        nonce: string
      }
  )

const TWO_FACTOR_CHALLENGE = 'two_factor_challenge'

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
    ttlSeconds: number | null = 60
  ): Promise<string> {
    if (ttlSeconds === null) return this.sign(data)

    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds
    return this.sign(data, { expiresIn: expiresAt })
  }

  async verifyQrToken(token: string): Promise<QrTokenPayload> {
    return this.verify<QrTokenPayload>(token)
  }

  async signTwoFactorChallenge(userId: number, ttlSeconds: number): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds
    return this.sign({ type: TWO_FACTOR_CHALLENGE, userId }, { expiresIn: expiresAt })
  }

  async verifyTwoFactorChallenge(token: string): Promise<number | null> {
    const payload = await this.verify<JWTPayload & { type?: unknown; userId?: unknown }>(token)

    if (payload.type !== TWO_FACTOR_CHALLENGE) return null
    if (typeof payload.userId !== 'number') return null

    return payload.userId
  }
}
