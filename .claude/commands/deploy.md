---
description: Deploy Клёво to Yandex Cloud Serverless. Runs pre-deployment checks,
  builds Docker images, and deploys via GitHub Actions or manual YC CLI.
  $ARGUMENTS: environment (dev | staging | prod) — default: dev
---

# /deploy $ARGUMENTS

## Environments

| Env | Trigger | DB | Confirmation |
|-----|---------|-----|-------------|
| dev | auto (every push to main) | dev DB | none |
| staging | manual | staging DB | none |
| prod | manual | production DB | REQUIRED |

## Pre-Deployment Checklist

### Always (blocking)

- [ ] All tests pass: `npm test --workspaces`
- [ ] TypeScript compiles: `npm run build --workspaces`
- [ ] No hardcoded secrets in code: `grep -r "API_KEY\|SECRET\|TOKEN" apps/ --include=*.ts | grep -v ".env\|example\|test"`
- [ ] `.env` not tracked: `git status | grep "\.env"`
- [ ] Docker build succeeds: `docker compose build`

### Staging/Prod only

- [ ] Database migrations reviewed
- [ ] Yandex Lockbox secrets up to date
- [ ] Rollback plan documented

### Prod only

- [ ] Tested on staging first
- [ ] Team notified
- [ ] Monitoring alerts configured

## Deployment Steps

### Dev (auto via GitHub Actions)

Push to main → GitHub Actions runs automatically:
1. `npm test --workspaces`
2. `docker compose build`
3. Deploy to Yandex Cloud Serverless Functions

### Staging / Prod (manual)

```bash
# 1. Ensure you're on correct branch
git status

# 2. Run pre-deployment checks
npm test --workspaces
npm run build --workspaces

# 3. Build Docker images
docker compose build

# 4. Deploy via YC CLI
yc serverless function version create \
  --function-name klyovo-api \
  --runtime nodejs22 \
  --entrypoint src/index.handler \
  --memory 256m \
  --execution-timeout 30s \
  --environment-variables-from-lockbox <lockbox-secret-id>

# 5. Verify deployment
curl https://api.klyovo.ru/health
```

## Database Migrations

```bash
# Apply migrations to target environment
DATABASE_URL=<target-db-url> npx prisma migrate deploy

# Verify migration applied
DATABASE_URL=<target-db-url> npx prisma migrate status
```

## Rollback

```bash
# Rollback to previous Serverless Function version
yc serverless function version list --function-name klyovo-api
yc serverless function set-scaling-policy \
  --function-name klyovo-api \
  --tag stable \
  --version-id <previous-version-id>
```

## Health Checks

After deployment, verify:
```bash
# API health
curl https://api.klyovo.ru/health

# Database connectivity
curl https://api.klyovo.ru/health/db

# Redis connectivity
curl https://api.klyovo.ru/health/redis

# TMA reachable
curl https://klyovo.ru
```

## Monitoring

- Metrics: Yandex Monitoring dashboard
- Errors: Yandex Cloud Logging
- Alerts: Configured in Yandex Monitoring (notify on >1% error rate)

## Secrets (Production)

All secrets in Yandex Lockbox — never in environment variables directly.
Lockbox secret IDs documented in internal team docs (not in this repo).
