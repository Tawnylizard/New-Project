# Development Guide — Клёво

## Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd klyovo
cp .env.example .env  # fill in your secrets

# 2. Bootstrap project from docs
/start

# OR manually:
npm install
docker compose up -d
npx prisma migrate dev --name init
npx prisma db seed
```

## Development Workflow

### Starting a New Feature

```bash
# Option 1: Auto-select (recommended)
/go <feature-name>        # scores complexity → /plan or /feature

# Option 2: Manual
/feature <feature-name>   # full SPARC lifecycle (plan→validate→implement→review)
/plan <task-name>         # lightweight (for simple tasks)
```

### Daily Workflow

```bash
# Start of day — see what to work on
/next

# Work on a feature
/go csv-import

# Check tests
/test

# Capture a tricky insight
/myinsights "CP1251 encoding fallback"
```

### Full MVP Build (autonomous)

```bash
/run           # bootstrap + implement all MVP features + tag v0.1.0-mvp
/run all       # implement ALL features including v1.0
```

## Command Reference

| Command | Description | When to use |
|---------|-------------|-------------|
| `/start` | Bootstrap monorepo skeleton | First time setup |
| `/feature <name>` | Full 4-phase feature lifecycle | New features |
| `/go [name]` | Smart pipeline auto-selection | Standard development |
| `/run [mvp\|all]` | Autonomous full build | Batch implementation |
| `/next [id]` | Sprint status & navigation | Daily standup |
| `/plan <task>` | Lightweight planning | Simple tasks |
| `/test [scope]` | Run tests & coverage | Before PR |
| `/deploy [env]` | Deploy to Yandex Cloud | Release |
| `/docs [rus\|eng]` | Generate bilingual docs | Documentation |
| `/myinsights <title>` | Capture dev insight | After solving tricky bug |

## Agent Reference

| Agent | Purpose | Invoke with |
|-------|---------|------------|
| `@planner` | Break down tasks into parallel subtasks | `/plan` or mention in chat |
| `@architect` | Architectural decisions, ADRs | "should we...", "architecture" |
| `@code-reviewer` | Security & quality review | `/feature` Phase 4 or manual |

## Skill Reference

| Skill | Purpose |
|-------|---------|
| `sparc-prd-mini` | SPARC documentation generator (used by /feature Phase 1) |
| `requirements-validator` | Document validation swarm (used by /feature Phase 2) |
| `brutal-honesty-review` | Code review swarm (used by /feature Phase 4) |
| `project-context` | Клёво product & market context |
| `coding-standards` | TypeScript monorepo conventions |
| `testing-patterns` | Jest + Fastify testing patterns |
| `security-patterns` | Telegram auth, ЮKassa, rate limiting |
| `feature-navigator` | Roadmap navigation (used by /next) |

## Monorepo Structure

```
apps/
├── api/              ← Fastify backend (Node.js 22 + TypeScript)
│   ├── routes/       ← thin handlers (validate → service → respond)
│   ├── services/     ← ALL business logic
│   └── plugins/      ← Fastify plugins (auth, rateLimit, telegram)
├── tma/              ← Telegram Mini App (React 18 + Vite)
│   ├── pages/        ← route targets
│   ├── components/   ← reusable UI
│   └── store/        ← Zustand state
└── bot/              ← Telegram Bot webhook handler
packages/
├── db/               ← Prisma schema + migrations
└── shared/           ← shared TypeScript types
```

## Feature Workflow

```
/next                           # see what to work on
/go <feature>                   # implement feature
/next <feature-id>              # mark done, cascade unblocking
/next                           # see next feature
```

## Autonomous Development

### Single Feature

```bash
/go <feature-name>              # auto-select pipeline, implement, commit, push
```

### Full MVP Build

```bash
/run                            # bootstrap → implement MVP features → tag v0.1.0-mvp
/run mvp                        # same as above
```

### Complete Project

```bash
/run all                        # bootstrap → implement ALL features → tag v1.0.0
```

### Documentation

```bash
/docs                           # generate in README/rus/ and README/eng/
/docs rus                       # Russian only
/docs eng                       # English only
/docs update                    # update existing docs
```

### Command Hierarchy

```
/run mvp
  └── /start (bootstrap once)
  └── LOOP:
      ├── /next (find next feature)
      └── /go <feature>
          ├── /plan (simple, score ≤-2)
          └── /feature (standard/complex)
              ├── Phase 1: PLAN (sparc-prd-mini)
              ├── Phase 2: VALIDATE (requirements-validator)
              ├── Phase 3: IMPLEMENT (parallel agents)
              └── Phase 4: REVIEW (brutal-honesty-review)
```

## Testing

```bash
npm test --workspaces           # all tests
npm test --workspace=apps/api   # api only
npm test --workspaces -- --coverage  # with coverage
```

Coverage targets: `services/` ≥80% lines, critical algorithms 100%.

## Secrets & Environment

- **Development:** `.env` file (see `.env.example`)
- **Production:** Yandex Lockbox
- Never commit `.env` or any secret files

Required env vars: `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `YANDEX_GPT_API_KEY`, `GIGACHAT_API_KEY`, `YUKASSA_SHOP_ID`, `YUKASSA_SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`

## Troubleshooting

**When you hit an error:**
1. `grep "ERROR_STRING" myinsights/1nsights.md` — check knowledge base first
2. If found → read the linked detail file
3. If not found → debug normally, then `/myinsights` to capture the fix

**Common issues:**
- `\w` doesn't match Cyrillic → use `[\u0400-\u04FF]` or `/u` flag
- Rate limiter bypass → ensure it's a singleton (module-level, not per-request)
- Sber CSV corrupt → it's CP1251, use iconv-lite fallback
- Amount calculation wrong → check you're using kopecks (integers)
- JWT algorithm confusion → always specify `algorithms: ['HS256']` explicitly
