import env from '#start/env'

const jwtConfig = {
  privateKey: Buffer.from(env.get('JWT_PRIVATE_KEY'), 'base64').toString('utf-8'),
  publicKey: Buffer.from(env.get('JWT_PUBLIC_KEY'), 'base64').toString('utf-8'),
  algorithm: 'RS256' as const,
}

export default jwtConfig
