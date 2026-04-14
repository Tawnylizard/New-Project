# Database Migrations — Клёво

## Migration Order

| Migration | Description |
|-----------|-------------|
| `20260101_init` | Full initial schema — all 9 models, enums, indexes, FK constraints |
| `20260414_add_streaks_achievements` | Superseded by init (kept for history) |

## Apply Migrations

### Fresh database (recommended)
```bash
# From project root
DATABASE_URL="postgresql://user:pass@localhost:5432/klyovo" \
  npx prisma migrate deploy --schema packages/db/schema.prisma
```

### Development (with reset)
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/klyovo_dev" \
  npx prisma migrate reset --schema packages/db/schema.prisma
```

### Manual SQL (без Prisma CLI)
```bash
psql $DATABASE_URL -f packages/db/migrations/20260101_init/migration.sql
```

## Seed (dev only)
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/klyovo_dev" \
  npx tsx packages/db/seed.ts
```

## Schema Models

| Model | Description |
|-------|-------------|
| `User` | Telegram user, plan, referral |
| `Transaction` | Imported transactions (kopecks) |
| `RoastSession` | AI roast history |
| `DetectedSubscription` | Auto-detected recurring payments |
| `KlyovoSubscription` | Paid Клёво Plus subscriptions |
| `BnplObligation` | BNPL installment tracking |
| `FinancialGoal` | User savings goals |
| `UserStreak` | Import & spending streaks |
| `UserAchievement` | Unlocked achievements |
