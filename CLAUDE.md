# CLAUDE.md — Клёво (Российский Cleo AI)

## Проект

**Клёво** — AI-финансовый ассистент для российского Gen Z (18–28 лет). Копия Cleo AI ($300M+ ARR) адаптированная для РФ-рынка.

- **Оригинал:** [meetcleo.com](https://meetcleo.com) — $500M оценка, 6M+ пользователей
- **Наш рынок:** Россия, Telegram Mini App как основной канал
- **Killer-feature:** «Жёсткий режим» — AI с характером критикует твои траты

## Архитектура (выбранная)

```
Frontend:  Telegram Mini App (React 18 + Vite + TailwindCSS)
Backend:   Node.js 22 + Fastify 5 + TypeScript (strict)
AI/LLM:    YandexGPT Pro (primary) → GigaChat (fallback) → cached
Database:  Yandex Managed PostgreSQL 16 via Prisma 5
Cache:     Yandex Managed Redis 7
Auth:      Telegram initData HMAC-SHA256 → JWT HS256 (7d)
Payments:  ЮKassa v3 (МИР / СБП / ЮMoney)
Hosting:   Yandex Cloud Serverless (ru-central1)
```

## Monorepo Structure

```
apps/tma        ← React TMA (pages/components/store)
apps/api        ← Fastify API (routes/services/plugins)
apps/bot        ← Telegram Bot webhook handler
packages/db     ← Prisma schema + migrations
packages/shared ← shared TypeScript types
```

## Ключевые документы

| Документ | Описание |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Product Requirements |
| [`docs/Architecture.md`](docs/Architecture.md) | System Architecture |
| [`docs/Specification.md`](docs/Specification.md) | API & Data Model |
| [`docs/Pseudocode.md`](docs/Pseudocode.md) | Algorithms |
| [`docs/Refinement.md`](docs/Refinement.md) | Edge Cases & Testing |
| [`docs/ADR/`](docs/ADR/) | Architecture Decision Records |

## Важные ограничения

1. **ФЗ-152:** Все ПД хранятся ТОЛЬКО в Yandex Cloud ru-central1
2. **Без лицензии ЦБ:** Продукт — информационный сервис, не финансовый посредник
3. **Без Visa/MC:** Оплата через МИР, СБП, ЮMoney
4. **AI дисклеймер:** Все советы сопровождаются «Это информационный сервис»
5. **Деньги:** ВСЕГДА в копейках (целые числа), НИКОГДА float

## Parallel Execution Strategy

Use `Task` tool to parallelize independent work:
- `apps/api` и `apps/tma` изменения → всегда параллельно
- Написание тестов + реализация → параллельно
- Несколько пакетов monorepo → параллельно (если нет зависимостей)
- Валидация / ревью → параллельные агенты

## Swarm Agents

| Agent | When to use |
|-------|------------|
| `@planner` | Разбить на задачи, создать план |
| `@architect` | Архитектурные решения, ADR |
| `@code-reviewer` | Ревью кода, безопасность |
| `@doc-validator` | Валидация документации |

## Available Agents

| Agent | File | Purpose |
|-------|------|---------|
| planner | `.claude/agents/planner.md` | Implementation planning from Pseudocode.md |
| code-reviewer | `.claude/agents/code-reviewer.md` | Security & quality review |
| architect | `.claude/agents/architect.md` | Architecture decisions & ADRs |

## Available Skills

| Skill | Purpose |
|-------|---------|
| `sparc-prd-mini` | Feature planning orchestrator |
| `explore` | Socratic questioning → Product Brief |
| `goap-research-ed25519` | GOAP A* research → Research Findings |
| `problem-solver-enhanced` | 9 modules + TRIZ → Solution Strategy |
| `requirements-validator` | Validation swarm |
| `brutal-honesty-review` | Post-implementation review |
| `project-context` | Клёво product context |
| `coding-standards` | TypeScript monorepo conventions |
| `testing-patterns` | Jest + Fastify inject patterns |
| `security-patterns` | Telegram auth, ЮKassa, rate limiting |
| `feature-navigator` | Roadmap navigation |

## Quick Commands

| Command | Purpose |
|---------|---------|
| `/start` | Bootstrap monorepo (5 parallel tasks) |
| `/feature <name>` | 4-phase feature lifecycle (SPARC) |
| `/go [name]` | Auto-select pipeline + implement |
| `/run` | Full MVP build loop |
| `/next` | Sprint status + next feature |
| `/plan <task>` | Lightweight planning |
| `/test` | Run tests + coverage |
| `/deploy` | Deploy to Yandex Cloud |
| `/docs` | Generate bilingual docs (RU/EN) |
| `/myinsights` | Capture development insight |

## Feature Development Lifecycle

New features use the 4-phase lifecycle: `/feature [name]`

1. **PLAN** — sparc-prd-mini → `docs/features/<n>/sparc/`
2. **VALIDATE** — requirements-validator swarm → score ≥70
3. **IMPLEMENT** — parallel agents from validated docs
4. **REVIEW** — brutal-honesty-review swarm → fix all criticals

Lifecycle skills in `.claude/skills/`:
`sparc-prd-mini`, `explore`, `goap-research-ed25519`, `problem-solver-enhanced`, `requirements-validator`, `brutal-honesty-review`

## Feature Roadmap

Current roadmap: [`.claude/feature-roadmap.json`](.claude/feature-roadmap.json)

**MVP Features (must_have):**
- `telegram-auth` — status: next
- `csv-import` — status: next
- `roast-mode` — status: next
- `subscription-hunter` — status: planned
- `bnpl-tracker` — status: planned
- `viral-sharing` — status: planned
- `payments-subscription` — status: planned
- `spending-dashboard` — status: planned

Use `/next` to navigate the roadmap.

## Development Insights (живая база знаний)

Index: [myinsights/1nsights.md](myinsights/1nsights.md) — check here FIRST before debugging.
On error: grep the error string in the index, read only the matched detail file.
Capture new findings: `/myinsights [title]`

## Implementation Plans

Plans saved to: `docs/plans/` (auto-committed on session end)
Create plan: `/plan <task-name>`

## Automation Commands

- `/go [feature]` — auto-select pipeline (/plan or /feature) and implement
- `/run` or `/run mvp` — bootstrap + implement all MVP features
- `/run all` — bootstrap + implement ALL features
- `/docs` — generate bilingual documentation (RU/EN) in README/
- `/docs update` — update existing documentation

### Command Hierarchy

```
/run mvp
  └── /start (bootstrap)
  └── LOOP:
      ├── /next (find next feature)
      └── /go <feature>
          ├── /plan (simple tasks, score ≤-2)
          └── /feature (standard/complex features, score >-2)
```

## Git Workflow

Format: `type(scope): description`

Scopes: `tma`, `api`, `bot`, `db`, `shared`, `roast`, `csv`, `auth`, `payments`, `insights`, `roadmap`

Examples:
- `feat(api): add CSV import with Sber/Tinkoff support`
- `fix(auth): reject expired Telegram initData`
- `feat(tma): add RoastMode page with share button`

## ADR Index

| ADR | Решение |
|---|---|
| [ADR-001](docs/ADR/ADR-001-product-name-and-positioning.md) | Название «Клёво», позиционирование |
| [ADR-002](docs/ADR/ADR-002-tech-stack.md) | Стек: Telegram TMA + YandexGPT + Yandex Cloud |
| [ADR-003](docs/ADR/ADR-003-monetization.md) | Freemium ₽199/мес, ЮKassa, МИР/СБП |
| [ADR-004](docs/ADR/ADR-004-distribution-channels.md) | Telegram-первый рост + ВК Клипы |
| [ADR-005](docs/ADR/ADR-005-data-compliance.md) | ФЗ-152, информационный сервис |
| [ADR-006](docs/ADR/ADR-006-cjm-variant.md) | CJM «Вирусный Roast» как основной путь |

## Целевые метрики MVP

| Метрика | Цель |
|---|---|
| MAU (3 мес) | 5 000 |
| Платные подписчики | 250 (5% конверсия) |
| Retention 30d | > 35% |
| Viral coefficient K | > 0.3 |
| Roast шеринг | > 15% активных |
