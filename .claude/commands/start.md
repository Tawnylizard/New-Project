---
description: Bootstrap entire Клёво project from documentation. Generates monorepo skeleton, all packages, Docker configs, database schema, core modules, and basic tests. $ARGUMENTS: optional flags --skip-tests, --skip-seed, --dry-run.
---

# /start $ARGUMENTS

## Purpose

One-command project generation from documentation → working monorepo with `docker compose up`.

## Prerequisites

- Documentation in `docs/` directory (SPARC docs already present)
- CC toolkit in project root (CLAUDE.md, .claude/)
- Node.js 22 LTS + npm installed
- Docker + Docker Compose installed
- Git initialized

## Process

### Phase 1: Foundation (sequential — everything depends on this)

1. **Read all project docs** to build full context:
   - `docs/Architecture.md` → monorepo structure, Docker Compose, tech stack
   - `docs/Specification.md` → data model, API endpoints, NFRs
   - `docs/Pseudocode.md` → core algorithms, business logic
   - `docs/PRD.md` → features, user personas (for README)
   - `docs/Refinement.md` → edge cases, testing strategy
   - `docs/Solution_Strategy.md` → architectural decisions

2. **Generate root configs:**
   - `package.json` (workspaces: apps/*, packages/*)
   - `tsconfig.base.json` (strict: true, target: ES2022)
   - `docker-compose.yml` (services: api, tma, postgres, redis)
   - `.env.example` (all required env vars — see docs/Specification.md)
   - `.gitignore` (node_modules, dist, .env, *.key)
   - `eslint.config.js` + `.prettierrc`

3. **Git commit:** `chore: project root configuration`

### Phase 2: Packages (parallel via Task tool ⚡)

Launch 5 parallel tasks:

#### Task A: packages/shared ⚡

Read and use as source:
- `docs/Pseudocode.md` → TypeScript types (User, Transaction, RoastSession, etc.)
- `docs/Architecture.md` → shared type definitions

Generate:
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/types.ts` (all shared TypeScript types from Pseudocode.md data structures)
- `packages/shared/src/index.ts`

**Commit:** `feat(shared): add shared TypeScript types`

#### Task B: packages/db ⚡

Read and use as source:
- `docs/Architecture.md` → Prisma schema (User, Transaction, RoastSession, DetectedSubscription, KlyovoSubscription models)
- `docs/Specification.md` → data model details, indexes

Generate:
- `packages/db/package.json`
- `packages/db/tsconfig.json`
- `packages/db/schema.prisma` (complete schema from Architecture.md)
- `packages/db/seed.ts` (dev seed data)
- `packages/db/src/index.ts` (re-export PrismaClient)

**Commit:** `feat(db): add Prisma schema with all models`

#### Task C: apps/api ⚡

Read and use as source:
- `docs/Architecture.md` → API routes, service structure, plugins
- `docs/Specification.md` → API endpoints, Zod schemas, NFRs
- `docs/Pseudocode.md` → service algorithms (CsvParser, Categorizer, RoastGenerator, etc.)
- `docs/Refinement.md` → edge cases, error handling

Generate:
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/src/index.ts` (Fastify server setup)
- `apps/api/src/routes/auth.ts` (POST /auth/telegram)
- `apps/api/src/routes/transactions.ts` (GET/POST /transactions/*)
- `apps/api/src/routes/roast.ts` (POST /roast/generate, GET /roast/history)
- `apps/api/src/routes/subscriptions.ts` (GET /subscriptions)
- `apps/api/src/routes/webhooks.ts` (POST /webhooks/yukassa)
- `apps/api/src/plugins/telegram.ts` (initData HMAC-SHA256 validator)
- `apps/api/src/plugins/jwt.ts` (JWT HS256 verify plugin)
- `apps/api/src/plugins/rateLimit.ts` (Redis-backed rate limiter SINGLETON)
- `apps/api/src/services/CsvParser.ts` (Sber + Tinkoff CSV, CP1251 fallback)
- `apps/api/src/services/Categorizer.ts` (merchant → category mapping)
- `apps/api/src/services/SubscriptionDetector.ts` (recurring payment detection)
- `apps/api/src/services/RoastGenerator.ts` (YandexGPT → GigaChat → cached fallback)
- `apps/api/src/services/PaymentService.ts` (ЮKassa integration)
- Basic test stubs in `apps/api/src/**/*.test.ts`

**Commits:** 
- `feat(api): add Fastify server with auth and rate limiting`
- `feat(api): add transaction, roast, subscription routes`
- `feat(api): add CSV parser and categorizer services`
- `feat(api): add roast generator with YandexGPT/GigaChat fallback`

#### Task D: apps/tma ⚡

Read and use as source:
- `docs/Architecture.md` → React component structure, pages, state
- `docs/PRD.md` → features, user flows, UI requirements
- `docs/Specification.md` → API endpoints to connect to

Generate:
- `apps/tma/package.json`
- `apps/tma/tsconfig.json`
- `apps/tma/vite.config.ts`
- `apps/tma/index.html`
- `apps/tma/tailwind.config.js`
- `apps/tma/src/main.tsx`
- `apps/tma/src/App.tsx` (router setup)
- `apps/tma/src/pages/Welcome.tsx`
- `apps/tma/src/pages/Onboarding.tsx`
- `apps/tma/src/pages/Dashboard.tsx`
- `apps/tma/src/pages/RoastMode.tsx`
- `apps/tma/src/pages/Subscriptions.tsx`
- `apps/tma/src/pages/BNPL.tsx`
- `apps/tma/src/pages/Paywall.tsx`
- `apps/tma/src/components/SpendingChart.tsx` (Recharts pie chart)
- `apps/tma/src/components/RoastCard.tsx` (display + share button)
- `apps/tma/src/components/TransactionList.tsx`
- `apps/tma/src/components/PaymentWidget.tsx`
- `apps/tma/src/store/useAppStore.ts` (Zustand store)
- `apps/tma/src/api/client.ts` (Axios + React Query setup)

**Commits:**
- `feat(tma): add Vite + React + TailwindCSS setup`
- `feat(tma): add pages (Welcome, Onboarding, Dashboard, RoastMode)`
- `feat(tma): add components (SpendingChart, RoastCard, TransactionList)`
- `feat(tma): add Zustand store and API client`

#### Task E: apps/bot ⚡

Read and use as source:
- `docs/Architecture.md` → Telegram Bot webhook handler

Generate:
- `apps/bot/package.json`
- `apps/bot/tsconfig.json`
- `apps/bot/src/index.ts` (webhook handler, basic /start command)

**Commit:** `feat(bot): add Telegram Bot webhook handler`

### Phase 3: Integration (sequential)

1. **Verify cross-package imports** (shared types used correctly in api and tma)
2. **Docker build:** `docker compose build`
3. **Start services:** `docker compose up -d`
4. **Database setup:**
   - `npx prisma migrate dev --name init`
   - `npx prisma db seed` (unless --skip-seed flag)
5. **Health check:** `curl http://localhost:3000/health`
6. **Run tests:** `npm test --workspaces` (unless --skip-tests flag)
7. **Git commit:** `chore: verify docker integration`

### Phase 4: Finalize

1. Generate/update `README.md` with quick start instructions
2. Final git tag: `git tag v0.1.0-scaffold`
3. Report summary: files generated, services running, what needs manual attention

## Output

After /start completes:
```
klyovo/
├── package.json                    # workspace root
├── docker-compose.yml              # api, tma, postgres, redis
├── .env.example                    # all required vars
├── .gitignore
├── tsconfig.base.json
├── apps/
│   ├── api/                        # Fastify backend (~25 files)
│   ├── tma/                        # React TMA (~20 files)
│   └── bot/                        # Telegram Bot (~3 files)
└── packages/
    ├── db/                         # Prisma schema + seed
    └── shared/                     # TypeScript types
```

## Flags

- `--skip-tests` — skip test file generation (faster, not recommended)
- `--skip-seed` — skip database seeding
- `--dry-run` — show plan without executing

## Estimated Time

- With parallel tasks: ~15-20 minutes
- Files generated: ~60-80 files
- Commits: ~12-15 commits

## Error Recovery

If a task fails mid-generation:
- All completed phases are committed to git
- Re-run `/start` — it detects existing files and skips completed phases
- Or fix the issue manually and continue

## Swarm Agents Used

| Phase | Agents | Parallelism |
|-------|--------|-------------|
| Phase 1 | Main | Sequential |
| Phase 2 | 5 Task tools | ⚡ Parallel |
| Phase 3 | Main | Sequential |
| Phase 4 | Main | Sequential |
