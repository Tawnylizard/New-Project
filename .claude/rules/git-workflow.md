# Git Workflow — Клёво

## Commit Format

```
type(scope): description
```

## Types

| Type | Use |
|------|-----|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `test` | Adding/updating tests |
| `docs` | Documentation changes |
| `chore` | Build, CI, config changes |
| `perf` | Performance improvement |
| `style` | Formatting, whitespace |

## Scopes (from monorepo packages)

| Scope | Maps to |
|-------|---------|
| `tma` | `apps/tma/` — Telegram Mini App |
| `api` | `apps/api/` — Fastify backend |
| `bot` | `apps/bot/` — Telegram Bot |
| `db` | `packages/db/` — Prisma schema |
| `shared` | `packages/shared/` — shared types |
| `roast` | roast generation features |
| `csv` | CSV parsing / import |
| `auth` | authentication |
| `payments` | ЮKassa / subscriptions |
| `insights` | myinsights knowledge base |
| `roadmap` | feature roadmap updates |

## Rules

- Commit after each **logical change** — never end-of-day mega-commits
- Never combine unrelated changes in one commit
- Write in **imperative mood**: "add", "fix", "refactor" (not "added", "fixed")
- Scope is optional but strongly recommended for monorepo clarity
- Reference issue numbers when applicable: `fix(api): correct JWT expiry check #42`

## Branching

```
main                    ← stable, always deployable
feature/<name>          ← new features (from main, PR back to main)
fix/<name>              ← bug fixes (from main, PR back to main)
```

## Pull Requests

- One feature per PR
- PR title follows commit format: `feat(tma): add roast share card`
- Squash merge to keep main history clean
- Require at least one review (when team > 1)

## Examples

```
feat(roast): implement YandexGPT Pro integration with GigaChat fallback
fix(csv): handle Windows-1251 encoding from Sberbank exports
refactor(api): extract CsvParser into standalone service class
test(api): add unit tests for subscription detector
docs(insights): capture Prisma upsert gotcha with compound keys
chore: update Prisma to 5.12.0
feat(payments): integrate ЮKassa webhook signature validation
fix(auth): reject initData older than 86400 seconds
```
