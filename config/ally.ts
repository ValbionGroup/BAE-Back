import env from '#start/env'
import { defineConfig, services } from '@adonisjs/ally'

export default defineConfig({
  eirbconnect: services.google({
    clientId: env.get('GOOGLE_CLIENT_ID'),
    clientSecret: env.get('GOOGLE_CLIENT_SECRET'),
    callbackUrl: 'http://localhost:3333/google/callback',
  }),
})
