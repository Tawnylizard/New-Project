# Refinement — «Клёво»

> SPARC Phase 6 · REFINEMENT · Edge Cases, Testing, Security Hardening  
> Дата: 2026-04-09

---

## Edge Cases Matrix

| Сценарий | Входные данные | Ожидаемое поведение | Обработка |
|---|---|---|---|
| CSV с 0 транзакциями | Пустой файл / только заголовок | Ошибка `empty_file` | Показать инструкцию по скачиванию |
| CSV Windows-1251 кодировка | Кириллица в ISO-8859-5 | Авто-декодирование | Попробовать CP1251 если UTF-8 fail |
| Транзакция на 0 рублей | amount = 0 | Пропустить строку | Не добавлять в БД |
| Входящий перевод (+ сумма) | amount > 0 | Пропустить (доход) | Не считать расходом |
| Дата в будущем | date > today | Пропустить | Log warning |
| Слишком длинное merchant name | > 255 символов | TRUNCATE(255) | Сохранить обрезанное |
| Дублированные транзакции | Повторный импорт того же CSV | Дедупликация по (user, date, amount, merchant) | UPSERT с ON CONFLICT |
| Пользователь без транзакций | 0 записей в БД | Показать «Загрузи данные» экран | Не вызывать LLM |
| LLM вернул пустую строку | response.text = '' | Retry до 2 раз, затем fallback | Показать шаблонный roast |
| LLM вернул оскорбительный текст | contains_offensive = true | Retry до 2 раз | Log, fallback text |
| ЮKassa webhook дубль | Повторный webhook с одним payment_id | Idempotency check по payment_id | SKIP если уже обработан |
| JWT истёк в процессе сессии | 401 на любом запросе | Авто-redirect в Telegram → refresh | Клиент перезапрашивает initData |
| Telegram initData устарел (> 24ч) | auth_date > 86400 сек назад | 401 EXPIRED_INIT_DATA | «Перезапусти приложение» |
| Файл > 5MB | filesize > 5_242_880 bytes | 413 FILE_TOO_LARGE | До загрузки на сервер |
| Пользователь отменил подписку на Плюс | plan: 'free' | Мгновенная деградация прав | Проверка плана при каждом запросе |
| Referral на себя | ref = own code | Игнорировать | Validate: referredBy ≠ userId |

---

## Testing Strategy

### Unit Tests (Jest + ts-jest)

**Цели:** ≥ 80% coverage на `services/`, 100% на критических алгоритмах

| Test ID | Модуль | Описание | Входные данные | Ожидаемый результат |
|---|---|---|---|---|
| UT-001 | CsvParser | Валидный Сбербанк CSV | sample_sber.csv | 87 транзакций, корректные суммы |
| UT-002 | CsvParser | Валидный Т-Банк CSV | sample_tbank.csv | 54 транзакции |
| UT-003 | CsvParser | Пустой файл | empty.csv | ParseError('empty_file') |
| UT-004 | CsvParser | Windows-1251 | cp1251.csv | Корректная кириллица |
| UT-005 | Categorizer | WB транзакция | 'WILDBERRIES RUB' | 'marketplace' |
| UT-006 | Categorizer | Яндекс Еда | 'YandexEda' | 'food_cafe' |
| UT-007 | Categorizer | Неизвестный мерчант | 'VASYA SHOP' | 'other' |
| UT-008 | SubDetector | 2 одинаковых платежа в 30 дней | [txn1, txn2] | 1 подписка |
| UT-009 | SubDetector | Нестабильная сумма (>10% stddev) | varying amounts | Не определять как подписку |
| UT-010 | TelegramAuth | Валидный initData | real_init_data | User объект |
| UT-011 | TelegramAuth | Невалидный hash | tampered data | Error(INVALID_INIT_DATA) |
| UT-012 | TelegramAuth | Устаревший auth_date | date > 86400s ago | Error(EXPIRED_INIT_DATA) |

---

### Integration Tests (Fastify inject)

| Test ID | Endpoint | Сценарий | Ожидаемый HTTP |
|---|---|---|---|
| IT-001 | POST /auth/telegram | Валидный initData | 200 + JWT |
| IT-002 | POST /auth/telegram | Невалидный initData | 401 |
| IT-003 | POST /transactions/import | Валидный CSV | 200 + count |
| IT-004 | POST /transactions/import | Без авторизации | 401 |
| IT-005 | POST /transactions/import | Файл > 5MB | 413 |
| IT-006 | POST /roast/generate | Free plan, 3 roast'а уже | 402 |
| IT-007 | POST /roast/generate | Plus plan | 200 + roast |
| IT-008 | GET /subscriptions | Нет транзакций | 200 + empty array |
| IT-009 | POST /subscriptions/checkout | Валидный план | 200 + payment_url |
| IT-010 | POST /webhooks/yookassa | Дублированный payment | 200 (idempotent) |

---

### E2E Tests (Playwright)

| Test ID | Сценарий | Шаги | Ожидаемый результат |
|---|---|---|---|
| E2E-001 | Happy Path: Регистрация → Roast | 1. Открыть TMA 2. Авторизоваться 3. Загрузить CSV 4. Нажать «Жёсткий режим» | Roast сгенерирован за < 5 сек |
| E2E-002 | Шеринг roast | После генерации → «Поделиться» → Telegram | Share URL содержит ref-код |
| E2E-003 | Upgrade flow | Free limit → Paywall → Оплата → Плюс активирован | plan == 'plus' в 5 сек после оплаты |
| E2E-004 | Referral | Пользователь А приглашает Б → Б платит | А получает уведомление о продлении |

---

## Performance Benchmarks

| Операция | Цель p50 | Цель p99 | Нагрузочный тест |
|---|---|---|---|
| Auth (initData validate) | < 100ms | < 300ms | 100 RPS |
| CSV parse (500 строк) | < 2s | < 5s | 20 RPS |
| Roast generate | < 3s | < 5s | 10 RPS |
| Dashboard load | < 500ms | < 1s | 50 RPS |
| Subscription detect | < 200ms | < 500ms | 50 RPS |

---

## Security Hardening

### Input Validation (Zod)

```typescript
// Каждый endpoint имеет Zod-схему
const ImportSchema = z.object({
  bank_type: z.enum(['sber', 'tbank']),
})

const RoastSchema = z.object({
  mode: z.enum(['harsh', 'soft']),
  period_days: z.union([z.literal(30), z.literal(60), z.literal(90)]),
})

const ManualTransactionSchema = z.object({
  amount: z.number().positive().max(10_000_000),  // макс ₽100K
  category: TransactionCategorySchema,
  transaction_date: z.string().datetime(),
  note: z.string().max(200).optional(),
})
```

### Rate Limiting Rules

| Endpoint | Лимит | Период | Действие при превышении |
|---|---|---|---|
| POST /auth/telegram | 10 req | 1 мин | 429 + 5 мин блок |
| POST /roast/generate | 5 req | 1 мин | 429 |
| POST /transactions/import | 3 req | 5 мин | 429 |
| ALL endpoints | 100 req | 1 мин | 429 + 1 мин блок |

### Audit Log

Все действия с ПД логируются в таблицу `audit_log`:
- Регистрация (consent)
- Импорт CSV
- Генерация roast
- Изменение плана
- Удаление аккаунта

---

## Technical Debt Items

| Элемент | Причина в MVP | Когда решить |
|---|---|---|
| Open Banking API (не CSV) | Нет единого стандарта в РФ | v2.0 (Т-Банк API) |
| Полнотекстовый поиск по транзакциям | Postgres FTS — избыточно для MVP | v1.0 |
| Многоязычность | Только RU в MVP | v2.0+ (для СНГ) |
| Веб-версия (не только TMA) | Telegram-first стратегия | v1.0 |
| Автоматические push-уведомления | Требует Telegram Bot integration | v1.0 |
| Machine Learning для категоризации | Rule-based достаточно для MVP | v2.0 |
