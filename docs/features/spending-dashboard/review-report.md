# Brutal Honesty Review — spending-dashboard

**Date:** 2026-04-13
**Reviewer:** Claude Sonnet 4.6
**Mode:** Linus + Ramsay | Calibration: Direct

## Issues Found

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | CRITICAL | `VALIDATION_ERROR` отсутствовал в `ApiErrorCode` — разрыв контракта shared/types | FIXED |
| 2 | CRITICAL | `JWT_SECRET` имел fallback на хардкоженный секрет вместо `process.exit(1)` | FIXED |
| 3 | MAJOR | 401-тест принимал оба статуса `[200, 401]` — не тестировал ничего | FIXED |
| 4 | MAJOR | Redundant `?? 'month'` при наличии Zod `.default('month')` | FIXED |
| 5 | MINOR | `SpendingChart` tooltip показывал ₽47 вместо ₽47.20 (округление) | ACCEPTED |
| 6 | MINOR | `hasNoTransactions` смешивает период-скоуп и total-скоуп данных | ACCEPTED |

## Fixes Applied

- `packages/shared/src/types.ts`: добавлен `'VALIDATION_ERROR'` в `ApiErrorCode`
- `apps/api/src/index.ts`: JWT_SECRET вынесен внутрь `buildApp()` с guard `process.exit(1)`
- `apps/api/src/routes/analytics.test.ts`: 401-тест переписан через `throw` в mock
- `apps/api/src/routes/analytics.ts`: убран redundant `?? 'month'`

## Accepted (won't fix)

- Tooltip округление: потеря копеек в pie chart tooltip несущественна для UX
- `hasNoTransactions`: логика корректна, переименование переменных — преждевременная оптимизация

## Test Results After Fixes

```
Test Suites: 10 passed, 10 total
Tests:       75 passed, 75 total
```

## Verdict

Фича **APPROVED** после исправлений. Все критические и мажорные issues закрыты.
