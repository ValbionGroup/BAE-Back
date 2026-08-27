import { execSync } from 'node:child_process'

if (process.env.MIGRATE === 'true') {
  console.log('Running migrations...')
  execSync('node ace migration:run --force', { stdio: 'inherit' })
}

// Le catalogue RBAC, et lui seul : les autres seeders portent « static
// environment = DEMO_ONLY » et le runner d'Adonis les écarte hors dev et test.
// Ceux qui restent n'ajoutent que ce qui manque, un second démarrage est donc
// sans effet. Cf. `database/seeder_environment.ts`.
if (process.env.SEED === 'true') {
  console.log('Seeding reference data...')
  execSync('node ace db:seed', { stdio: 'inherit' })
}

console.log('Starting server...')
await import('./bin/server.js')
