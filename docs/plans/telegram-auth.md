# Plan: Telegram Auth

**Created:** 2026-04-10
**Scope:** `apps/api` — routes/auth.ts, plugins/telegram.ts, plugins/jwt.ts
**Estimated effort:** 1-2 часа

## Goal

Полностью реализовать и протестировать авторизацию через Telegram initData: HMAC-SHA256 валидация, find-or-create User, выдача JWT.

## Context

Scaffold из `/start` создал рабочий код, но без тестов и без обработки реферального кода. `telegram-auth` — блокирующая зависимость для всех остальных MVP фич.

## Tasks

### Phase 1: Доводка реализации (sequential)

- [x] **[Уже готово]**: `apps/api/src/plugins/telegram.ts` — HMAC-SHA256 + auth_date check
- [x] **[Уже готово]**: `apps/api/src/routes/auth.ts` — POST /auth/telegram, find-or-create user, JWT
- [x] **[Добавить]**: передача `ref` параметра при регистрации → `referredBy` в User
  - File: `apps/api/src/routes/auth.ts`
  - Commit: `feat(auth): link referral code on new user registration`

### Phase 2: Тесты (parallel ⚡)

- [x] ⚡ **[Unit tests]**: `validateTelegramInitData` — все сценарии
  - File: `apps/api/src/plugins/telegram.test.ts`
  - Покрыть: valid HMAC, invalid HMAC, expired auth_date, missing hash, missing user
  - Commit: `test(auth): unit tests for Telegram initData HMAC validation`

- [x] ⚡ **[Integration tests]**: `POST /auth/telegram` via Fastify inject
  - File: `apps/api/src/routes/auth.test.ts`
  - Покрыть: success (200 + JWT), invalid HMAC (401), expired initData (401), missing field (400)
  - Commit: `test(auth): integration tests for POST /auth/telegram`

### Phase 3: Финал (sequential)

- [x] Запустить `npm test --workspace=apps/api` — убедиться что все тесты проходят
- [x] TypeScript check: `npx tsc --project apps/api/tsconfig.json --noEmit`

## Files to Touch

| File | Action | Package |
|------|--------|---------|
| `apps/api/src/routes/auth.ts` | modify (referral) | api |
| `apps/api/src/plugins/telegram.test.ts` | create | api |
| `apps/api/src/routes/auth.test.ts` | create | api |

## Risks

- **Prisma в integration тестах**: требует реального PostgreSQL. Решение: мокируем `@klyovo/db` на уровне jest moduleNameMapper для route-level тестов.
- **Timing тестов**: `auth_date` чувствителен к времени. Решение: мокируем `Date.now()` в unit тестах.

## Definition of Done

- [x] TypeScript компилируется без ошибок
- [x] Unit тесты: 100% coverage на `validateTelegramInitData`
- [x] Integration тест: 5 сценариев покрыты
- [x] Referral linking реализован
- [x] `npm test --workspace=apps/api` — green (24/24)
