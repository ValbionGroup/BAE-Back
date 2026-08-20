import env from '#start/env'

const lydiaConfig = {
  driver: env.get('LYDIA_DRIVER'),
  url: env.get('LYDIA_URL'),
  vendorToken: env.get('LYDIA_VENDOR_TOKEN').release(),
  privateToken: env.get('LYDIA_PRIVATE_TOKEN').release(),
  callbackBaseUrl: env.get('LYDIA_CALLBACK_BASE_URL').replace(/\/$/, ''),
  publicAppUrl: env.get('PUBLIC_APP_URL').replace(/\/$/, ''),
}

export default lydiaConfig
