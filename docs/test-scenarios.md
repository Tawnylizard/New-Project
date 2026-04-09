# Test Scenarios — «Клёво»

> BDD Scenarios (Gherkin) · Phase 2 · 2026-04-09

---

## US-002: Авторизация через Telegram

### Scenario: Happy Path — успешная авторизация
```gherkin
Given I open @klyovobot in Telegram
When the Mini App loads and sends valid initData to POST /auth/telegram
Then the server validates HMAC-SHA256 signature
And returns HTTP 200 with { token, user }
And I see my Telegram display name in the app header
And the response time is < 1 second
```

### Scenario: Error — невалидный initData
```gherkin
Given I send a POST /auth/telegram with a tampered initData (wrong hash)
When the server validates the signature
Then the response is HTTP 401
And the body contains { error: "INVALID_INIT_DATA" }
And the app shows: "Сессия истекла. Открой бота заново."
```

### Scenario: Edge case — устаревший auth_date
```gherkin
Given I send a POST /auth/telegram with auth_date = 90000 seconds ago
When the server checks auth_date > 86400
Then the response is HTTP 401
And the body contains { error: "EXPIRED_INIT_DATA" }
```

### Scenario: Security — rate limiting на auth
```gherkin
Given I send 11 POST /auth/telegram requests within 1 minute
When the 11th request arrives
Then the response is HTTP 429
And the server blocks my IP for 5 minutes
And the body contains { error: "RATE_LIMIT_EXCEEDED" }
```

### Scenario: Security — replay attack prevention
```gherkin
Given valid initData was used to authenticate successfully
When I replay the same initData request 25 hours later
Then the response is HTTP 401 EXPIRED_INIT_DATA
```

---

## US-003: Импорт CSV-выписки

### Scenario: Happy Path — валидный Сбербанк CSV
```gherkin
Given I am authenticated as a free plan user
And I have a valid Сбербанк CSV file (UTF-8, semicolon-delimited, 87 transactions)
When I POST /transactions/import with the file and bank_type=sber
Then the response is HTTP 200
And the body contains { imported: 87, skipped: 0 }
And the response time is < 10 seconds
And the CSV file is deleted from Object Storage
```

### Scenario: Happy Path — Т-Банк CSV с Windows-1251
```gherkin
Given I have a Т-Банк CSV file encoded in Windows-1251
When I POST /transactions/import with bank_type=tbank
Then the server auto-detects encoding and converts to UTF-8
And returns HTTP 200 with correctly parsed Cyrillic merchant names
```

### Scenario: Error — файл > 5MB
```gherkin
Given I try to upload a CSV file of 6MB
When the request reaches the upload endpoint
Then the response is HTTP 413 FILE_TOO_LARGE
And no file is stored on the server
And the error is shown before upload: "Файл слишком большой. Максимум — 5 МБ."
```

### Scenario: Error — невалидный формат файла
```gherkin
Given I upload a .xlsx file renamed to .csv
When the server attempts to parse it
Then the response is HTTP 422
And the body contains { error: "INVALID_CSV_FORMAT" }
And I see: "Не удалось прочитать файл. Попробуй скачать выписку снова."
```

### Scenario: Edge case — дублированный импорт
```gherkin
Given I have already imported a CSV with 87 transactions
When I upload the same CSV again
Then the server uses UPSERT with ON CONFLICT (userId, transactionDate, amountKopecks, merchantNormalized)
And returns HTTP 200 with { imported: 0, skipped: 87 }
And no duplicate transactions appear in my list
```

### Scenario: Edge case — free plan, история > 3 мес
```gherkin
Given I am on free plan
And my CSV contains transactions from 6 months ago
When the import processes
Then only transactions from the last 3 months are stored
And I see a soft paywall note: "Полная история — в Клёво Плюс"
```

### Scenario: Security — инъекция через CSV
```gherkin
Given I upload a CSV where merchant_name = "'; DROP TABLE transactions; --"
When the server parses and inserts the transaction
Then the merchant name is stored as a literal string (parameterized query)
And the transactions table is NOT affected
And no 500 error occurs
```

---

## US-005: AI Roast Mode

### Scenario: Happy Path — генерация roast на Plus плане
```gherkin
Given I am authenticated as a Plus plan user
And I have 87 transactions loaded for April 2026
When I POST /roast/generate { mode: "harsh", period_days: 30 }
Then the response is HTTP 200 within 5 seconds
And the roast text contains specific numbers from my data (e.g., "₽12 400")
And the roast is in Russian informal (ты-форма)
And the roast does NOT contain profanity or slurs
And a RoastSession is created in the database
```

### Scenario: Error — free plan limit exceeded
```gherkin
Given I am on free plan
And I have already generated 3 roasts this month
When I POST /roast/generate
Then the response is HTTP 402
And the body contains { error: "ROAST_LIMIT_EXCEEDED", plan: "free", limit: 3 }
And the frontend shows soft paywall: "Безлимитный Жёсткий режим — в Клёво Плюс"
```

### Scenario: Edge case — LLM timeout → fallback
```gherkin
Given YandexGPT Pro API times out after 5 seconds
When the roast generation is attempted
Then the system retries once with GigaChat
And if GigaChat also fails, returns a cached fallback roast
And the response is still HTTP 200 (not 500)
And an alert LLM_UNAVAILABLE is triggered in monitoring
```

### Scenario: Security — пользователь без транзакций
```gherkin
Given I am authenticated but have 0 transactions
When I POST /roast/generate
Then the response is HTTP 422
And the body contains { error: "NO_TRANSACTIONS" }
And the LLM is NOT called (no wasted API credits)
```

---

## US-007: BNPL-трекер

### Scenario: Happy Path — BNPL транзакции обнаружены
```gherkin
Given I have transactions with merchant names containing "DOLAMI", "SPLIT", "ПОДЕЛИ"
When I GET /transactions/bnpl within 2 seconds
Then I see total outstanding amount aggregated across all services
And a breakdown: Долями ₽X, Сплит ₽Y, Подели ₽Z
And a timeline sorted by upcoming payment date
```

### Scenario: Edge case — нет BNPL транзакций
```gherkin
Given I have 50 transactions with no BNPL patterns
When I open the BNPL section
Then I see: "У тебя нет активных BNPL-платежей 🎉"
And the endpoint returns HTTP 200 with { bnpl: [], total: 0 }
```

### Scenario: Warning — BNPL > 30% дохода
```gherkin
Given I have set my monthly income to ₽50 000
And my total BNPL obligations are ₽18 000 (36%)
When the dashboard loads
Then I see a warning card: "⚠️ BNPL занимает 36% твоего дохода"
And an AI comment is shown without calling the LLM (template-based for performance)
```

---

## US-008: Подписка Клёво Плюс

### Scenario: Happy Path — оплата через СБП
```gherkin
Given I am on free plan and tap "Клёво Плюс"
When I select "Оплатить через СБП" and complete the ЮKassa widget
Then ЮKassa sends a webhook POST /webhooks/yookassa
And the server verifies the webhook signature
And within 5 seconds my plan is updated to PLUS in the database
And I receive a Telegram message: "✅ Клёво Плюс активирован!"
```

### Scenario: Error — дублированный webhook
```gherkin
Given ЮKassa sends the same payment webhook twice (payment_id = "pay_12345")
When the second webhook arrives
Then the server checks if payment_id is already processed
And returns HTTP 200 (idempotent)
And the plan is NOT double-applied or double-extended
```

### Scenario: Edge case — истечение подписки
```gherkin
Given my planExpiresAt = yesterday
When I make any request requiring Plus features
Then the server checks planExpiresAt on every request
And my plan is downgraded to FREE immediately
And I see: "Подписка истекла. Продлить — X секунд."
```

### Scenario: Security — webhook без валидной подписи
```gherkin
Given I send a fake POST /webhooks/yookassa with forged payment data
When the server validates the ЮKassa HMAC signature
Then the response is HTTP 401
And the payment is NOT processed
And the event is logged in audit_log as WEBHOOK_INVALID_SIGNATURE
```

---

## US-009: Шеринг roast

### Scenario: Happy Path — поделиться в Telegram
```gherkin
Given I have a generated roast with text "Ты потратил ₽47к за апрель..."
When I tap "Отправить в Telegram" and select a chat
Then the message contains: roast text + "Проверь свои траты: t.me/klyovobot?ref=[my_ref_code]"
And the ref link contains MY unique referral code
```

### Scenario: Happy Path — реферальный бонус
```gherkin
Given user A shared their roast with referral link ref=ABC123
When user B follows the link and subscribes to Клёво Плюс
Then a webhook confirms user B's payment
And user A's planExpiresAt is extended by 30 days
And user A receives a Telegram notification: "🎁 Твой друг подписался! Месяц Плюс — тебе в подарок"
```

### Scenario: Security — реферал на себя
```gherkin
Given I am user A with referralCode = "ABC123"
When I follow my own referral link and subscribe
Then the server detects referredBy == userId
And the self-referral is ignored (no bonus applied)
And the subscription proceeds normally
```

---

## Сводка BDD покрытия

| Story | Happy Path | Error | Edge Case | Security | Итого |
|---|---|---|---|---|---|
| US-002 Auth | 1 | 1 | 1 | 2 | 5 |
| US-003 CSV Import | 2 | 2 | 2 | 1 | 7 |
| US-005 Roast Mode | 1 | 1 | 1 | 1 | 4 |
| US-007 BNPL | 1 | 1 | 1 | — | 3 |
| US-008 Subscription | 1 | 1 | 1 | 1 | 4 |
| US-009 Sharing | 1 | — | — | 1 | 2 (+ referral) |
| **Итого** | **7** | **6** | **6** | **6** | **25** |
