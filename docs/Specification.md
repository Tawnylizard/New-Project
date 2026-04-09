# Specification — «Клёво»

> SPARC Phase 3 · SPECIFICATION · User Stories + Acceptance Criteria + NFRs  
> Дата: 2026-04-09

---

## Executive Summary

**Клёво** — Telegram Mini App, который анализирует финансовые траты российской молодёжи 18–28 лет и генерирует язвительные AI-комментарии («roast»). Freemium: базовый анализ бесплатно, безлимитный roast + автосбережения за ₽199/мес.

**MVP scope:** Импорт трат (CSV/ручной ввод) → AI-анализ → Roast Mode → Поиск подписок-паразитов → BNPL-трекер → Подписка через ЮKassa.

---

## Feature Matrix

| Функция | MVP | v1.0 | v2.0 |
|---|---|---|---|
| Авторизация через Telegram initData | ✅ | ✅ | ✅ |
| Импорт CSV (Сбер, Т-Банк) | ✅ | ✅ | ✅ |
| Ручной ввод трат | ✅ | ✅ | ✅ |
| Категоризация трат (РФ-мерчанты) | ✅ | ✅ | ✅ |
| Топ-5 категорий расходов | ✅ | ✅ | ✅ |
| Roast Mode (Жёсткий режим) | ✅ | ✅ | ✅ |
| Поиск подписок-паразитов | ✅ | ✅ | ✅ |
| BNPL-трекер (Долями, Сплит, Подели) | ✅ | ✅ | ✅ |
| Шеринг roast в Telegram/ВК | ✅ | ✅ | ✅ |
| Реферальная программа | ✅ | ✅ | ✅ |
| Подписка ₽199/мес через ЮKassa | ✅ | ✅ | ✅ |
| Финансовые цели | — | ✅ | ✅ |
| Автосбережения (рекомендации) | — | ✅ | ✅ |
| Стрики и ачивки | — | ✅ | ✅ |
| Еженедельные отчёты | — | ✅ | ✅ |
| Интеграция Т-Банк Open API | — | — | ✅ |
| Мультибанковский агрегатор | — | — | ✅ |
| Цифровой рубль (копилка) | — | — | ✅ |
| Голосовой ввод | — | — | ✅ |

---

## User Stories + Acceptance Criteria

### US-001: Первый запуск без регистрации

```
As a new user,
I want to see a demo of Roast Mode without signing up,
So that I understand the product's value before committing.

Acceptance Criteria:
Given I open @klyovobot for the first time
When the welcome screen loads
Then I see a "Попробовать демо" button without any login prompt

Given I tap "Попробовать демо"
When the demo loads
Then I see 3 example roast messages based on fictional spending data
And each roast is funny and specific (not generic)
And there is a CTA "Загрузи свои траты" after the demo

Given I see the demo
When I tap "Загрузи свои траты"
Then I am taken to the Telegram auth flow (1-click)
```

---

### US-002: Авторизация через Telegram

```
As a user,
I want to log in using my Telegram account,
So that I don't need to remember a separate password.

Acceptance Criteria:
Given I tap "Войти"
When Telegram initData is validated on the server
Then I am logged in within 2 seconds
And my Telegram display name is shown in the app
And no additional registration form is shown

Given initData is invalid or expired
When the validation fails
Then I see an error "Сессия истекла. Открой бота заново."
And the app reloads @klyovobot
```

---

### US-003: Импорт CSV-выписки

```
As a logged-in user,
I want to upload a CSV bank statement,
So that Клёво can analyze my real spending.

Acceptance Criteria:
Given I am on the "Загрузить данные" screen
When I tap "Загрузить CSV"
Then I see upload instructions for Сбербанк and Т-Банк
And a file picker opens

Given I upload a valid Сбербанк CSV (UTF-8, semicolon-delimited)
When the file is parsed
Then transactions are imported within 10 seconds
And I see a success message with the count: "Загружено 87 транзакций"
And I am redirected to the analysis screen

Given I upload a file that is not a valid bank CSV
When parsing fails
Then I see: "Не удалось прочитать файл. Попробуй скачать выписку снова."
And the original file is not stored on the server

Given the CSV contains transactions older than 3 months (free plan)
When processing
Then only the last 3 months are shown
And a soft paywall note appears: "Полная история — в Клёво Плюс"
```

---

### US-004: Ручной ввод трат

```
As a user without a CSV export,
I want to enter my spending manually,
So that I can still use the app.

Acceptance Criteria:
Given I tap "Ввести вручную"
When the manual input form opens
Then I can enter: amount (₽), category (dropdown), date, optional note

Given I enter a valid transaction
When I tap "Добавить"
Then the transaction is saved and appears in my list within 1 second

Given I enter an amount of 0 or negative
When I tap "Добавить"
Then I see inline validation: "Сумма должна быть больше 0"
And the transaction is NOT saved
```

---

### US-005: AI Roast Mode (Жёсткий режим)

```
As a user with spending data loaded,
I want to get an AI roast of my spending,
So that I feel motivated to change my behavior (and laugh).

Acceptance Criteria:
Given I have at least 5 transactions loaded
When I tap "Жёсткий режим 🔥"
Then a roast is generated within 5 seconds
And the roast references specific numbers from MY data (not generic)
And the roast is in Russian, informal tone (ты-форма)
And the roast is humorous but not offensive or demeaning

Given the roast is displayed
When I read it
Then there is a "Поделиться" button
And the share preview includes the roast text and Клёво branding
And there is a "Ещё один roast" button (limited to 3/month on free plan)

Given I am on free plan and have used 3 roasts this month
When I tap "Жёсткий режим"
Then I see a soft paywall: "Безлимитный Жёсткий режим — в Клёво Плюс"
```

---

### US-006: Поиск подписок-паразитов

```
As a user,
I want to see a list of recurring charges I may have forgotten about,
So that I can cancel the ones I don't use.

Acceptance Criteria:
Given I have at least 30 days of transaction history
When I open the "Подписки" tab
Then I see a list of recurring charges grouped by merchant
And each entry shows: merchant name, amount, frequency, last charge date

Given a merchant charges the same amount within ±5% every 28–35 days
When it appears in my history 2+ times
Then it is detected as a potential subscription

Given I tap "Это паразит" on a subscription
When I confirm
Then the subscription is marked as "to cancel"
And I see a helper text: "Как отменить подписку [merchant name]" with a link if available
```

---

### US-007: BNPL-трекер

```
As a user who uses "Долями", "Сплит", or "Подели",
I want to see my total BNPL obligations in one place,
So that I understand my real financial commitments.

Acceptance Criteria:
Given I have BNPL transactions in my CSV matching patterns:
  - "DOLAMI" / "ДОЛЯМИ" / "Dolami"
  - "SPLIT" / "СПЛИТ" / "Tinkoff Split"
  - "PODELI" / "ПОДЕЛИ" / "Podeli"
  - "BNPL" (generic)
When I open the "BNPL" section within 2 seconds
Then I see total outstanding amount across all BNPL services
And a breakdown by service (Долями, Сплит, Подели)
And a timeline of upcoming payments sorted by date ascending

Given my BNPL obligations exceed 30% of my monthly income (if income is set)
When the dashboard loads
Then I see a warning card: "⚠️ BNPL занимает X% твоего дохода"
And an AI comment about this

Given I have NO BNPL transactions in my history
When I open the "BNPL" section
Then I see: "У тебя нет активных BNPL-платежей 🎉"
```

---

### US-008: Подписка Клёво Плюс

```
As a free user who wants more features,
I want to subscribe to Клёво Плюс,
So that I get unlimited roasts, goals, and auto-saving tips.

Acceptance Criteria:
Given I tap "Клёво Плюс" from a soft paywall or the settings menu
When the subscription screen opens
Then I see: price (₽199/мес or ₽1490/год), feature list, payment options

Given I choose "Оплатить через СБП"
When ЮKassa payment flow opens
Then I complete payment within the ЮKassa widget (not redirected away from Telegram)
And within 5 seconds of payment confirmation I have Плюс features unlocked
And I receive a Telegram message: "✅ Клёво Плюс активирован!"

Given my subscription expires
When the renewal date passes without successful payment
Then my account reverts to free plan
And I see a notification: "Подписка истекла. Продлить — X секунд."
```

---

### US-009: Шеринг roast

```
As a user who got a funny roast,
I want to share it with friends,
So that I can entertain them and potentially get a referral bonus.

Acceptance Criteria:
Given I tap "Поделиться"
When the share sheet opens
Then I see options: "Отправить в Telegram", "Поделиться в ВКонтакте", "Скопировать"

Given I choose "Отправить в Telegram"
When I select a chat
Then the message includes: roast text + "Проверь свои траты: t.me/klyovobot?ref=[my_id]"
And the referral link is my unique ref link

Given a friend clicks my referral link and subscribes to Плюс
When their payment is confirmed
Then I receive a notification: "🎁 Твой друг подписался! Месяц Плюс — тебе в подарок"
And my next billing cycle is extended by 30 days
```

---

## Non-Functional Requirements

### Performance

| Метрика | Требование |
|---|---|
| Время авторизации (Telegram initData) | < 1 сек |
| Парсинг CSV (1000 транзакций) | < 10 сек |
| Генерация roast (YandexGPT) | < 5 сек |
| Загрузка дашборда | < 2 сек |
| API response time (p99) | < 500 мс |
| Availability (uptime) | > 99.5% |

### Security

| Требование | Реализация |
|---|---|
| Персональные данные только в РФ | Yandex Cloud ru-central1 |
| Авторизация | Telegram initData HMAC-SHA256 валидация |
| Данные транзакций | Шифрование AES-256 at rest |
| CSV файлы | Удаляются сразу после парсинга (не хранятся) |
| API | Rate limiting: 100 req/мин на пользователя |
| SQL Injection | Parameterized queries (Prisma ORM) |
| XSS | Content Security Policy, sanitized inputs |

### Scalability

- Serverless functions (Yandex Cloud) — горизонтальное масштабирование автоматически
- Redis caching для повторных запросов к YandexGPT (одинаковые паттерны трат)
- PostgreSQL connection pooling через PgBouncer

### Compliance (ФЗ-152)

- Явное согласие на обработку ПД при регистрации
- Право на удаление данных (GDPR-совместимо)
- Все ПД только в Yandex Cloud ru-central1
- DPA (Data Processing Agreement) с Yandex Cloud
- AI советы: дисклеймер «Это информационный сервис»

### Accessibility

- Поддержка системного dark mode (Telegram тема)
- Минимальный размер tap target: 44px
- Русский язык — единственный язык MVP

---

## Success Metrics (MVP)

| Метрика | Цель | Срок |
|---|---|---|
| MAU | 5 000 | 3 мес |
| Платные подписчики | 250 | 3 мес |
| Конверсия free→paid | ≥ 5% | 3 мес |
| Retention 30d | > 35% | 3 мес |
| Viral coefficient K | > 0.3 | 3 мес |
| Roast sharing rate | > 15% активных | ongoing |
| Onboarding completion | > 70% | ongoing |
| CSV upload success rate | > 80% | ongoing |
| Roast generation p99 | < 5 сек | ongoing |
