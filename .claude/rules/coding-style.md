# Coding Style Rules — Клёво

## Language & Framework

- **Primary language:** TypeScript 5 (strict mode)
- **Backend:** Node.js 22 LTS + Fastify 5 + Prisma 5
- **Frontend:** React 18 + Vite 5 + TailwindCSS 3
- **Linting:** ESLint + Prettier (project standard configuration)

## TypeScript Rules

- `"strict": true` in tsconfig — no exceptions
- Use explicit return types on all exported functions
- Prefer `interface` for object types, `type` for unions/intersections
- Use `unknown` over `any`; if casting is needed: `(value as unknown as TargetType)`
- Never use `!` non-null assertion without a comment explaining why it's safe

## Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Files (TS) | PascalCase for classes, camelCase for modules | `CsvParser.ts`, `auth.ts` |
| React components | PascalCase | `RoastCard.tsx` |
| Variables/functions | camelCase | `roastText`, `generateRoast()` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE_BYTES` |
| Database fields | camelCase (Prisma) | `telegramId`, `planExpiresAt` |
| API routes | kebab-case | `/roast/generate`, `/transactions/import` |
| Environment vars | SCREAMING_SNAKE_CASE | `YANDEX_GPT_API_KEY` |

## File Organization

### Backend (apps/api)

```
routes/        ← Fastify route handlers (thin controllers only)
services/      ← Business logic (CsvParser, RoastGenerator, etc.)
plugins/       ← Fastify plugins (auth, rateLimit, telegram)
packages/db/   ← Prisma schema + migrations ONLY
packages/shared/ ← TypeScript types shared across apps
```

- Routes are thin: validate input → call service → return response
- Services contain ALL business logic
- Services are testable without HTTP context

### Frontend (apps/tma)

```
pages/         ← Top-level page components (route targets)
components/    ← Reusable UI components
store/         ← Zustand state (useAppStore.ts)
```

- Components are pure when possible (no side effects)
- State management via Zustand, not component state for shared data
- API calls via React Query (not direct axios in components)

## Import Order

1. Node built-ins
2. External packages
3. Internal packages (`@klyovo/shared`, `@klyovo/db`)
4. Relative imports
5. Type-only imports (with `import type`)

## Code Patterns

### Amounts (Money)

```typescript
// ALWAYS store in kopecks (integer), NEVER use float for money
const amount: number = 4720  // ₽47.20 = 4720 kopecks
const display = (amount / 100).toFixed(2)  // for display only
```

### Error Handling

```typescript
// Use custom error classes, not string throws
throw new AppError('INVALID_INIT_DATA', 401, 'Telegram initData is invalid')

// Fastify error handler catches these and formats consistently
```

### Prisma Queries

```typescript
// Always scope to authenticated user
const txns = await prisma.transaction.findMany({
  where: { userId: ctx.user.id, ...filters },
  orderBy: { transactionDate: 'desc' }
})
```

### LLM Calls (Retry Pattern)

```typescript
// Required: try YandexGPT → GigaChat → cached fallback
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

### React Components

```tsx
// Props interface always explicit
interface RoastCardProps {
  roast: RoastSession
  onShare: () => void
}

export const RoastCard: React.FC<RoastCardProps> = ({ roast, onShare }) => {
  // ...
}
```

## Testing Patterns

- Jest + ts-jest for unit tests
- Fastify inject for integration tests (no real HTTP)
- Playwright for E2E
- Test files: `*.test.ts` alongside source files
- Coverage targets: ≥80% lines on `services/`, 100% on critical algorithms

## Known Gotchas

### TypeScript / JavaScript

- `\w` in regex does NOT match Cyrillic characters.
  Use `[\u0400-\u04FF]` or `\p{L}` with `/u` flag for Russian text matching.
  This affects merchant name normalization and CSV parsing.

- Direct type casting `req as CustomType` fails with TS2352.
  Use double-cast: `(req as unknown as CustomType)`.
  Better: use Fastify typed route handlers with generics.

- Jest `coverageThreshold` (singular) silently fails if spelled `coverageThresholds` (plural).
  Per-directory thresholds require a `global` key. ts-jest needs `ts-node` as peer dependency.

- `jest.fn(async () => value)` doesn't satisfy `jest.Mocked<T>` in strict mode.
  Use `jest.fn().mockResolvedValue(value)` or `jest.fn().mockImplementation(...)`.

### Fastify / Node.js

- Services with rate limiters (Redis-backed) MUST be singletons.
  Per-request instances bypass protection — breaker never accumulates failures.

- Fastify `reply.send()` after `reply.hijack()` causes double-response error.
  Use `return reply` pattern, not `reply.send(); return`.

### Prisma / PostgreSQL

- `SET LOCAL` in PostgreSQL only affects the current transaction.
  Use `set_config()` with parameterized calls for RLS.

- Prisma `upsert` with `@@unique` on compound keys requires all fields in `where`.
  For transaction deduplication: `{ userId_transactionDate_amountKopecks_merchantNormalized: {...} }`.

### CSV Parsing

- Sber CSV uses semicolons (`;`) as delimiter, Tinkoff uses commas (`,`).
  Auto-detect by checking first line.

- Windows-1251 encoded CSVs from Sberbank: try UTF-8 first, if parse fails retry with CP1251.
  Use `iconv-lite` library.

- Amount parsing: Sber uses comma as decimal separator (`1 234,56`), strip spaces first.

### Telegram Mini App

- `window.Telegram.WebApp.initData` is empty string in browser dev mode.
  Use mock initData for local development (never commit real initData).

- TMA `themeParams` can change while app is open (user switches dark/light).
  Subscribe to `onThemeChanged` event if using theme colors directly.
