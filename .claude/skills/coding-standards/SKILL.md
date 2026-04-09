---
name: coding-standards
description: >
  Coding standards and conventions for Клёво TypeScript monorepo. Covers naming,
  file organization, Fastify patterns, React TMA patterns, Prisma usage, and
  project-specific gotchas. Use when generating code, reviewing code quality,
  or setting up new modules. Triggers on "how to code", "coding standards",
  "naming convention", "project patterns".
version: "1.0"
maturity: production
---

# Coding Standards — Клёво

## Language & Framework Versions

- TypeScript 5 (strict mode — no exceptions)
- Node.js 22 LTS + Fastify 5 + Prisma 5
- React 18 + Vite 5 + TailwindCSS 3

## TypeScript Rules

- `"strict": true` — no exceptions
- Explicit return types on all exported functions
- `interface` for object types, `type` for unions/intersections
- `unknown` over `any`; cast: `(value as unknown as TargetType)`
- No `!` non-null assertion without explanatory comment

## Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Files (classes) | PascalCase | `CsvParser.ts`, `RoastGenerator.ts` |
| Files (modules) | camelCase | `auth.ts`, `rateLimit.ts` |
| React components | PascalCase | `RoastCard.tsx`, `SpendingChart.tsx` |
| Variables/functions | camelCase | `roastText`, `generateRoast()` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_ROAST_PER_MONTH` |
| DB fields (Prisma) | camelCase | `telegramId`, `planExpiresAt` |
| API routes | kebab-case | `/roast/generate`, `/transactions/import` |
| Environment vars | SCREAMING_SNAKE_CASE | `YANDEX_GPT_API_KEY` |

## Backend File Organization (apps/api)

```
routes/        ← thin handlers: validate → service → respond
services/      ← ALL business logic (CsvParser, RoastGenerator, etc.)
plugins/       ← Fastify plugins (auth, rateLimit, telegram)
packages/db/   ← Prisma schema ONLY — no business logic
packages/shared/ ← TypeScript types shared across apps
```

Routes must be thin:
```typescript
// ✅ Correct
fastify.post('/roast/generate', { schema }, async (req, reply) => {
  const result = await roastService.generate(req.user.id, req.body)
  return result
})

// ❌ Wrong — logic in route
fastify.post('/roast/generate', async (req) => {
  const txns = await prisma.transaction.findMany(...)
  const prompt = buildPrompt(txns)
  const text = await yandexGpt.call(prompt)
  // ...
})
```

## Frontend File Organization (apps/tma)

```
pages/         ← route targets (Welcome, Dashboard, RoastMode, etc.)
components/    ← reusable UI (RoastCard, SpendingChart, etc.)
store/         ← Zustand state (useAppStore.ts)
api/           ← React Query + Axios client
```

- State: Zustand for global, component state for local
- API: React Query (never raw fetch/axios in components)
- Components: pure when possible (no side effects)

## Money (CRITICAL)

```typescript
// ALWAYS store in kopecks (integer)
const amount: number = 4720  // ₽47.20

// NEVER use float for money
const wrong: number = 47.20  // ❌ WRONG

// Display only
const display = (amount / 100).toFixed(2)
const formatted = `₽${(amount / 100).toLocaleString('ru-RU')}`
```

## Error Handling

```typescript
// Custom error classes
throw new AppError('INVALID_INIT_DATA', 401, 'Telegram initData is invalid')

// Fastify error handler catches and formats consistently
// Never throw raw strings
```

## Prisma Queries

```typescript
// Always scope to authenticated user
const txns = await prisma.transaction.findMany({
  where: { userId: ctx.user.id, ...filters },  // NEVER omit userId
  orderBy: { transactionDate: 'desc' }
})
```

## LLM Calls

```typescript
async function generateWithFallback(prompt: string): Promise<string> {
  try {
    return await yandexGpt.generate(prompt, { timeout: 5000 })
  } catch {
    try {
      return await gigaChat.generate(prompt, { timeout: 5000 })
    } catch {
      return getCachedFallbackRoast()
    }
  }
}
```

## React Components

```tsx
interface RoastCardProps {
  roast: RoastSession
  onShare: () => void
}

export const RoastCard: React.FC<RoastCardProps> = ({ roast, onShare }) => {
  // ...
}
```

## Import Order

1. Node built-ins
2. External packages
3. Internal packages (`@klyovo/shared`, `@klyovo/db`)
4. Relative imports
5. Type-only imports (`import type`)

## Key Gotchas

- **`\w` ≠ Cyrillic**: Use `[\u0400-\u04FF]` or `\p{L}` with `/u` flag
- **Direct cast fails**: Use `(x as unknown as T)` not `x as T` for TS2352
- **`coverageThreshold`** (singular) — `coverageThresholds` plural silently fails
- **Rate limiter singleton**: Create ONCE at module level — per-request = bypass protection
- **Prisma upsert**: All compound key fields required in `where`
- **Sber CSV**: Windows-1251, semicolons — use iconv-lite for encoding
- **Amount parsing**: `1 234,56` → strip spaces, replace comma with dot
