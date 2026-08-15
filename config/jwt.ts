import env from '#start/env'

const jwtConfig = {
  // `JWT_PRIVATE_KEY` est déclarée en `Env.schema.secret()` : la valeur arrive
  // enveloppée dans un `Secret`, dont il faut extraire la chaîne. Sans
  // `.release()`, `Buffer.from()` reçoit un objet et rend une clé illisible —
  // `jose` échouait alors sur « "pkcs8" must be PKCS#8 formatted string ».
  privateKey: Buffer.from(env.get('JWT_PRIVATE_KEY').release(), 'base64').toString('utf-8'),
  publicKey: Buffer.from(env.get('JWT_PUBLIC_KEY'), 'base64').toString('utf-8'),
  algorithm: 'RS256' as const,
}

export default jwtConfig
