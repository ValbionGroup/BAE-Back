import env from '#start/env'

const sumupConfig = {
  driver: env.get('SUMUP_DRIVER'),
  url: env.get('SUMUP_URL'),
  apiKey: env.get('SUMUP_API_KEY').release(),
  merchantCode: env.get('SUMUP_MERCHANT_CODE'),
  readerId: env.get('SUMUP_READER_ID'),
  callbackBaseUrl: env.get('SUMUP_CALLBACK_BASE_URL').replace(/\/$/, ''),
}

export default sumupConfig
