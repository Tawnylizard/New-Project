---
name: project-context
description: >
  Deep project context for Клёво. Contains product vision, target audience, competitive
  positioning, business model, and strategic context. Use when answering "why" questions
  about product decisions, explaining the Russian market context, or providing background
  for feature planning. Triggers on "project context", "why this", "business reason", "market".
version: "1.0"
maturity: production
---

# Project Context — Клёво

## What Is Клёво?

AI-финансовый ассистент для российской молодёжи 18–28 лет. Копия Cleo AI ($300M+ ARR) адаптированная для РФ-рынка. Работает как Telegram Mini App.

**Killer-feature:** «Жёсткий режим» — AI критикует траты с юмором, как честный друг.

## Why Now

- 83% платежей в РФ — безналичные → данные о тратах цифровые
- BNPL вырос на 300%+ → молодёжь накапливает скрытые долги
- 67% Gen Z тревожится о деньгах, но не хочет «скучных» приложений
- Telegram Mini Apps — нулевое трение для 82% аудитории
- Западные аналоги (Cleo AI, Mint) недоступны в РФ

## Target User

- 18–28 лет, Россия
- Telegram ≥ 2ч/день
- Карта Т-Банка или Сбера
- Доход ₽20K–100K/мес
- Финансово тревожен, но не хочет банковских интерфейсов

## Business Model

**Freemium:**
- Free: анализ трат, 3 roast/мес, подписки-паразиты, BNPL-трекер
- Клёво Плюс (₽199/мес): безлимит roast, финансовые цели, автосбережения, стрики

**Target metrics (3 months):**
- MAU: 5,000
- Paid: 250 (5% conversion)
- MRR: ₽49,750
- Retention 30d: >35%
- Viral coefficient K: >0.3
- Roast sharing: >15% active users

## Distribution Strategy (ADR-004)

- Primary: «Вирусный Roast» — shareable roast cards → Telegram + ВК Клипы
- Secondary: Реферальная программа (1 месяц Плюс за платящего друга)
- Organic: SEO, ВК, TikTok-style content about personal finance

## Competitive Positioning

| Competitor | Why Not |
|-----------|---------|
| Cleo AI | Not in Russia, no RUB |
| Сбербанк | No humor, boring, bank app |
| Дзен-мани | Desktop-first, not Gen Z |
| Тинькофф | Bank product, not standalone |

**Our edge:** Character + humor + Telegram-native + viral mechanics.

## Legal Context (ADR-005)

- **ФЗ-152**: ALL personal data in Yandex Cloud ru-central1 only
- **No CB license**: Information service only (not financial advisor)
- **Disclaimer mandatory**: «Клёво — информационный сервис, не финансовый советник»
- **User rights**: Consent at onboarding, right to delete in settings

## Key Features (MVP)

1. **Roast Mode** — AI analysis + язвительный комментарий (YandexGPT Pro)
2. **CSV Import** — Сбер (Windows-1251, semicolons) + Т-Банк (UTF-8, commas)
3. **Subscription Hunter** — find dead recurring payments
4. **BNPL Tracker** — aggregate Долями/Сплит/Подели debts
5. **Viral Sharing** — shareable roast cards + referral program
6. **Subscription** — ЮKassa, МИР/СБП/ЮMoney

## Roadmap

| Version | Timeline | Key Features |
|---------|----------|--------------|
| MVP | Month 1-2 | Auth + CSV + Roast + Sharing + Payments |
| v1.0 | Month 3-4 | Financial goals + Streaks + Push notifications |
| v2.0 | Month 5-6 | Т-Банк Open API + Multi-bank + Voice input |
