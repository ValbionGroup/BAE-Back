import env from '#start/env'

const lydiaConfig = {
  driver: env.get('LYDIA_DRIVER'),
  url: env.get('LYDIA_URL'),
  // `Env.schema.secret()` enveloppe la valeur dans un `Secret` : sans
  // `.release()`, c'est sa représentation qui partirait chez Lydia.
  vendorToken: env.get('LYDIA_VENDOR_TOKEN').release(),
  privateToken: env.get('LYDIA_PRIVATE_TOKEN').release(),
  // Barre finale retirée des deux côtés : ces bases sont concaténées à des
  // chemins qui commencent par `/`, et Lydia refuse les URL à double barre.
  callbackBaseUrl: env.get('LYDIA_CALLBACK_BASE_URL').replace(/\/$/, ''),
  publicAppUrl: env.get('PUBLIC_APP_URL').replace(/\/$/, ''),
}

export default lydiaConfig
