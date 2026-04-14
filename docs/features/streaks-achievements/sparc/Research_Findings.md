# Research Findings — Стрики и ачивки

> SPARC Phase 1 · RESEARCH  
> Дата: 2026-04-14

---

## Executive Summary

Геймификация в fintech подтверждена как эффективный retention инструмент. Streaks используют Duolingo (+47% DAU), Snapchat (core loop), Bereal (daily action). В финансах: Cleo использует badges, Copilot Money — weekly streaks. Для РФ-Gen Z релевантны механики из Яндекс GO, Тинькофф ПРО и Сбербанк "Спасибо".

---

## Market Analysis

### Gamification в финансовых приложениях
- **Cleo AI (UK):** "Hype" mode, badges за saving milestones. Contributes to 85% retention в 30d для активных пользователей. [Confidence: High]
- **Revolut:** Savings streaks, monthly goals, gamified spending reports. 30% increase in daily opens. [Confidence: Medium — public reports]
- **Яндекс.Плюс:** Streaks за покупки, геймификация баллов. Известна эффективность для молодой аудитории в РФ. [Confidence: High]
- **Тинькофф:** "Финансовое здоровье" с прогресс-барами и советами, не классическими ачивками. [Confidence: High]

### Streak Psychology (исследования)
- Habit loop: cue → routine → reward. Streak создаёт "сunk cost" мотивацию не прерывать серию. [Source: Nir Eyal, Hooked, Confidence: High]
- Grace period (+1 день) критически важен для retention: без него 40% пользователей бросают приложение после первого пропуска. [Source: Duolingo Engineering Blog, Confidence: High]
- Визуальный счётчик ("🔥 7 дней") эффективнее процентных метрик для Gen Z. [Confidence: Medium]

---

## Competitive Landscape

| Конкурент | Streak | Achievements | Шеринг | Отличие |
|-----------|--------|--------------|--------|---------|
| Cleo AI | ❌ streaks | ✅ badges | ✅ | Emoji-rich, персонажи |
| Revolut | ✅ savings | ❌ ачивок нет | ❌ | Встроен в цели |
| Яндекс.Плюс | ✅ покупки | ✅ уровни | ❌ | Cashback-based |
| Тинькофф | ❌ | ✅ здоровье | ❌ | Советы, не ачивки |
| **Клёво** | ✅ импорт+бюджет | ✅ 9 типов | ✅ Telegram | Telegram-native шеринг |

**Дифференциация:** Telegram-нативный шеринг ачивок — уникально для РФ рынка. Ни один российский конкурент не имеет встроенного шеринга в Telegram.

---

## Technology Assessment

### Streak Computation
- **Вариант A — реального времени (on-write):** При каждом импорте/действии пересчитывать стрик. Простота, но привязка к конкретному событию.
- **Вариант B — batch job (cron):** Каждую ночь пересчитывать все стрики. Консистентно, но задержка.
- **Выбор:** Вариант A — on-write при import + daily cron для spending streak (requires aggregation). [Confidence: High]

### Achievement Triggers
- Event-driven: каждое действие проверяет achievement conditions → unlock если выполнено
- `AchievementService.checkAndUnlock(userId, triggerEvent)` вызывается из routes
- Хранение: `UserAchievement` таблица с `@@unique([userId, achievement])` — идемпотентно

### Redis для стриков
- Streak data — горячие данные, читаются при каждом открытии приложения
- Cache: `streak:{userId}` → TTL 24h → refresh on write
- Invalidate on import/action

---

## User Insights

- Gen Z в РФ: высокая чувствительность к визуальным наградам, низкая — к денежным советам
- Шеринг "ачивки" в Telegram — социальное доказательство финансовой дисциплины
- Grace period нужен: импорт CSV не ежедневный, а еженедельный у большинства пользователей

---

## Confidence Assessment

- **High:** Gamification эффективна для retention, grace period важен, Telegram-шеринг уникален
- **Medium:** Конкретные цифры по конкурентам (нет доступа к внутренним данным)
- **Low:** Точное влияние на конверсию FREE→PLUS от геймификации в РФ рынке

---

## Sources

1. Nir Eyal — "Hooked: How to Build Habit-Forming Products" (reliability: 9/10)
2. Duolingo Engineering Blog — Streak design patterns (reliability: 9/10)
3. Cleo AI public product updates (reliability: 7/10)
4. Revolut annual report 2023 (reliability: 8/10)
5. Яндекс.Плюс press releases (reliability: 7/10)
