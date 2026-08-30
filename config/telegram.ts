import env from '#start/env'

const telegramConfig = {
  driver: env.get('TELEGRAM_DRIVER'),
  apiUrl: env.get('TELEGRAM_API_URL').replace(/\/$/, ''),
  botToken: env.get('TELEGRAM_BOT_TOKEN').release(),
  botUsername: env.get('TELEGRAM_BOT_USERNAME').replace(/^@/, ''),
  webhookSecret: env.get('TELEGRAM_WEBHOOK_SECRET').release(),
  webhookBaseUrl: env.get('TELEGRAM_WEBHOOK_BASE_URL').replace(/\/$/, ''),
}

export default telegramConfig
