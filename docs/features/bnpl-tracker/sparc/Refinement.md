# Refinement: BNPL-трекер

## Edge Cases Matrix

| Сценарий | Input | Expected | Handling |
|---|---|---|---|
| Нет BNPL транзакций | Обычные транзакции | found: 0, obligations: [] | Показать «Рассрочек не найдено» |
| Один платёж (< 2) | 1 BNPL-транзакция | Не создаётся obligation | Skip: `if txns.length < 2` |
| Нестабильные суммы | Суммы разнятся >5% | Не создаётся obligation | Skip: stddev/mean > 0.05 |
| Нестандартный провайдер | "INSTALLMENT PAY" | null provider | detectProvider возвращает null, транзакция пропускается |
| Все платежи сделаны | paidInstallments >= total | status: completed | Автоматически в scan |
| Просроченный платёж | nextPaymentDate < now | status: overdue | Автоматически в scan |
| Повторный scan | obligation уже есть | Upsert: обновляет paidInstallments | `@@unique` constraint + upsert |
| Пользователь скрыл, потом ресканировал | status: dismissed | Upsert НЕ перезаписывает dismissed | В update: не менять status |
| Разные суммы у Сплит (скидка на первый) | Первый платёж меньше | Небольшое расхождение | Допуск ±5% через stddev |
| Транзакций > 1000 | Большой CSV | < 200ms | Детектор O(n), in-memory группировка |

## Testing Strategy

### Unit Tests (BnplDetector.test.ts)
- detectProvider: все 4 провайдера + unknown → null
- detectProvider: case-insensitive matching
- detect: пустой массив → []
- detect: 1 транзакция → []
- detect: 2 транзакции Долями (14 дней) → 1 obligation, frequencyDays=14
- detect: 2 транзакции Сплит (30 дней) → 1 obligation, frequencyDays=30
- detect: нестабильные суммы → 0 obligations
- detect: completed (4/4 оплачено, Долями)
- detect: overdue (nextPaymentDate в прошлом)
- detect: смешанные транзакции (BNPL + обычные) → только BNPL

### Integration Tests (bnpl.test.ts)
- POST /bnpl/scan без токена → 401
- POST /bnpl/scan, нет транзакций → { found: 0 }
- POST /bnpl/scan, есть BNPL → { found: N, obligations: [...] }
- POST /bnpl/scan дважды → idempotent (upsert)
- GET /bnpl без токена → 401
- GET /bnpl → список obligations + summary
- GET /bnpl?status=active → только active
- PATCH /bnpl/:id { status: "dismissed" } → 200
- PATCH /bnpl/:wrongId → 404
- PATCH /bnpl/:другогоUser → 404 (userId scope)

## Test Data Fixtures

```typescript
// BNPL fixtures для тестов
const DOLYAMI_TXNS = [
  { merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000,
    transactionDate: new Date('2025-01-01'), isBnpl: false },
  { merchantNormalized: 'DOLYAMI MVIDEO', amountKopecks: 250000,
    transactionDate: new Date('2025-01-15'), isBnpl: false },
]

const SPLIT_TXNS = [
  { merchantNormalized: 'TINKOFF SPLIT ZARA', amountKopecks: 180000,
    transactionDate: new Date('2025-01-05'), isBnpl: false },
  { merchantNormalized: 'TINKOFF SPLIT ZARA', amountKopecks: 180000,
    transactionDate: new Date('2025-02-05'), isBnpl: false },
]
```

## Performance Optimizations

- `BnplDetector.detect()` — чистая функция, O(n) сложность
- DB index: `@@index([userId, status])` для фильтрации
- Scan + upsert: `Promise.all()` для параллельных upsert (как в subscriptions.ts)
- GET /bnpl: данные из DB без пересчёта детектора (пересчёт только при scan)

## Security Hardening

- userId всегда из JWT payload, не из request body
- PATCH /:id: findFirst с `{ id, userId }` перед update (IDOR защита)
- Zod: status enum строго ограничен допустимыми значениями
- isBnpl/bnplService на Transaction обновляются только через scan (server-side)

## Technical Debt

- totalInstallments для Сплит — оценочный (не знаем точно). Улучшение: хранить историю и уточнять.
- merchantDisplay сейчас = merchantNormalized. Улучшение: словарь merchantNormalized → красивое имя.
- Яндекс Сплит паттерны нуждаются в реальных данных для уточнения.
