# Docker Setup Guide

This guide explains how to use Docker and the dev container for the BAE Backend API.

## Files Created

- `Dockerfile` - Production-ready multi-stage Docker image
- `Dockerfile.dev` - Development Docker image with hot reload
- `.dockerignore` - Excludes unnecessary files from Docker builds
- `docker-compose.yml` - Production deployment configuration
- `docker-compose.dev.yml` - Development environment with hot reload
- `.devcontainer/devcontainer.json` - VS Code dev container configuration
- `.github/workflows/ci.yml` - Continuous Integration workflow
- `.github/workflows/docker-build.yml` - Docker build and push workflow

## Quick Start

### Development with Docker Compose

1. Start the development environment:

   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. View logs:

   ```bash
   docker-compose -f docker-compose.dev.yml logs -f api-dev
   ```

3. Stop the environment:
   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

### Production with Docker Compose

1. Build and start the production environment:

   ```bash
   docker-compose up -d --build
   ```

2. View logs:

   ```bash
   docker-compose logs -f api
   ```

3. Stop the environment:
   ```bash
   docker-compose down
   ```

### VS Code Dev Container

1. Install the "Dev Containers" extension in VS Code
2. Open the project folder in VS Code
3. Press `F1` and select "Dev Containers: Reopen in Container"
4. VS Code will build and start the dev container automatically

The dev container provides:

- Full development environment with all dependencies
- PostgreSQL database
- Hot reload for code changes
- Pre-configured VS Code extensions
- Git and GitHub CLI

## Docker Commands

### Build Production Image

```bash
docker build -t bae-backend:latest .
```

### Run Production Container

```bash
docker run -d \
  --name bae-api \
  -p 3333:3333 \
  -e APP_KEY=your-secret-key \
  -e DB_HOST=postgres \
  -e DB_PASSWORD=your-db-password \
  bae-backend:latest
```

### Execute Commands in Container

```bash
# Run migrations
docker-compose exec api node ace migration:run

# Access container shell
docker-compose exec api sh

# Run Ace commands
docker-compose exec api node ace --help
```

## CI/CD

### GitHub Actions Workflows

#### CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request:

- Linting with ESLint
- Type checking with TypeScript
- Unit and integration tests
- Build verification

#### Docker Build Workflow (`.github/workflows/docker-build.yml`)

Builds and pushes Docker images:

- Triggered on push to `main` or `develop` branches
- Creates multi-platform images (amd64, arm64)
- Pushes to GitHub Container Registry (ghcr.io)
- Tags images based on branch, PR, or version tags

### Image Tags

The CI/CD pipeline creates the following tags:

- `latest` - Latest build from main branch
- `main` - Latest build from main branch
- `develop` - Latest build from develop branch
- `v1.2.3` - Semantic version tags
- `pr-123` - Pull request builds
- `main-sha-abc123` - Git commit SHA tags

### Using Published Images

Pull and run the latest image:

```bash
docker pull ghcr.io/[your-username]/bae-back:latest
docker run -d -p 3333:3333 ghcr.io/[your-username]/bae-back:latest
```

## Environment Variables

Required environment variables (see `.env.example`):

- `NODE_ENV` - Environment (development, production, test)
- `PORT` - API port (default: 3333)
- `HOST` - API host (default: localhost)
- `APP_KEY` - Application secret key
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_DATABASE` - Database name
- `SESSION_DRIVER` - Session driver (cookie, memory, database)

## Health Checks

The Docker image includes health checks:

- Interval: 30 seconds
- Timeout: 3 seconds
- Start period: 40 seconds
- Retries: 3

Check container health:

```bash
docker inspect --format='{{.State.Health.Status}}' bae-api
```

## Database Migrations

Run migrations in the container:

```bash
# Development
docker-compose -f docker-compose.dev.yml exec api-dev pnpm ace migration:run

# Production
docker-compose exec api node ace migration:run
```

## Database Seeding

Seeders come in two kinds: the reference data every environment needs (RBAC
catalogue, job list, sale categories) and the demonstration data. The demo
seeders declare `static environment = DEMO_ONLY`
(`database/seeder_environment.ts`), so the Adonis runner skips them outside
development and test — `db:seed` has no `--force` guard of its own.

```bash
# Development — everything, demonstration data included
docker-compose -f docker-compose.dev.yml exec api-dev pnpm ace db:seed

# Production — reference data only, the demo seeders report "ignored"
docker-compose exec api node ace db:seed
```

The reference seeders are idempotent, so running them again is a no-op. To
cherry-pick, pass `--files "database/seeders/01_role_seeder.ts"` — the extension
is stripped before matching, so the same path works against the compiled image.

## Reverse proxy (Apache)

En production l'API n'est pas exposée directement : `INTERNET → Apache → Docker`.
Quatre réglages du vhost pèsent lourd sur la latence perçue et **n'ont aucun
équivalent en local**, ce qui explique qu'un site rapide sur `localhost` puisse
traîner en production.

```apache
<VirtualHost *:443>
    ServerName api.example.tld

    # 1. Réutiliser les connexions vers le conteneur.
    #    Apache 2.4 ne les réutilise PAS par défaut hors balancer : sans ce
    #    drapeau, chaque requête proxifiée refait une poignée de main TCP.
    ProxyPass        / http://127.0.0.1:3333/ enablereuse=on
    ProxyPassReverse / http://127.0.0.1:3333/

    # 2. HTTP/2. Sans lui le navigateur plafonne à 6 connexions par origine, et
    #    une page qui lance dix appels les sérialise en vagues. Le flux SSE de
    #    Transmit (`__transmit/events`) en occupe une en permanence.
    Protocols h2 http/1.1

    # 3. Compresser le JSON. AdonisJS ne compresse rien, et nginx ne sert que les
    #    fichiers statiques des deux fronts — les réponses de l'API partaient
    #    brutes.
    AddOutputFilterByType DEFLATE application/json
</VirtualHost>
```

Et le quatrième, dans la configuration globale : **le MPM doit être `event`**,
pas `prefork`. `prefork` fige un processus par connexion, ce qui sature vite
quand chaque onglet ouvert garde un flux SSE.

Vérifier l'état réel du serveur :

```bash
apachectl -M | grep -E 'http2|deflate|mpm|proxy_http'
apachectl -S
```

Et vérifier depuis l'extérieur que la compression arrive bien jusqu'au client :

```bash
curl -sI https://api.example.tld/v1/events -H 'Accept-Encoding: gzip, br' \
  | grep -i -e content-encoding -e 'HTTP/'
```

`Content-Encoding: gzip` et `HTTP/2` attendus. Si l'un manque, le réglage
correspondant n'est pas actif.

## Troubleshooting

### Container won't start

- Check logs: `docker-compose logs api`
- Verify environment variables in `.env`
- Ensure PostgreSQL is healthy: `docker-compose ps`

### Database connection issues

- Ensure DB_HOST is set to `postgres` (service name)
- Check PostgreSQL is running: `docker-compose ps postgres`
- Verify credentials match between services

### Port already in use

- Change PORT in `.env` file
- Or stop the service using the port

### Hot reload not working in dev container

- Ensure volumes are mounted correctly in `docker-compose.dev.yml`
- Rebuild the container: `docker-compose -f docker-compose.dev.yml up -d --build`

## Best Practices

1. **Never commit `.env` files** - Use `.env.example` as a template
2. **Use specific version tags** in production, not `latest`
3. **Run migrations** before starting the API in production
4. **Monitor container health** using health checks
5. **Use secrets management** for sensitive values in production
6. **Regular security updates** - rebuild images periodically

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AdonisJS Documentation](https://docs.adonisjs.com/)
