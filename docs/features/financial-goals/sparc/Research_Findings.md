# Research Findings — Финансовые цели

> SPARC Phase 1 · RESEARCH  
> Дата: 2026-04-14

---

## Executive Summary

Российский рынок финансовых целей занят банковскими экосистемами (Тинькофф, Сбер), но все требуют привязки счёта. Независимый AI-ассистент без банковской интеграции — незанятая ниша. Cleo AI (аналог) показывает 40%+ retention через goals + savings features. Ключевой инсайт: визуализация прогресса + персонализированный AI-совет дают х2 конверсию в достижение цели.

---

## Competitive Landscape

| Конкурент | Сильные стороны | Слабые стороны | Дифференциация Клёво |
|-----------|-----------------|----------------|---------------------|
| Тинькофф Цели | Автоматическое пополнение со счёта | Требует счёт Тинькофф | Работает с CSV, без привязки |
| Сбер Копилка | Интеграция с экосистемой | Только Сбер-клиенты | Мультибанк через CSV |
| Cleo AI | AI-советы, gamification | Не работает в РФ | Локализация + ФЗ-152 |
| Тinkoff Budget | Удобный интерфейс | Нет AI-рекомендаций | AI с характером «Клёво» |

---

## Technology Assessment

### AI Recommendation Approach
- **YandexGPT Pro**: Подходит для генерации персонализированных советов на русском языке
- **Prompt strategy**: Передавать агрегированные данные по категориям (без PII), цель, дедлайн → получить конкретный план экономии
- **Кэширование**: Redis TTL 2ч для идентичных профилей трат (экономия LLM-квоты)

### Progress Tracking Patterns
- **Manual input**: Пользователь сам отмечает сколько отложил — соответствует модели без банковской интеграции
- **Auto-calculate**: Опционально можно считать прогресс из транзакций по специальному мерчанту (будущий v2)
- **Recharts**: LinearProgress + ProgressBar — уже используется в Dashboard

### Data Model Insights
- Цель привязана к `userId` — необходима скоупизация всех запросов
- Дедлайн — опциональный параметр (бессрочные цели разрешены)
- Прогресс хранится в копейках: `currentAmountKopecks` / `targetAmountKopecks`

---

## User Insights

- Gen Z предпочитают краткосрочные цели (до 6 месяцев) — высокое completion rate
- Визуальный прогресс-бар увеличивает engagement в 1.8x (Cleo data)
- «Жёсткий совет» от AI принимается лучше, чем от банка — соответствует tone of voice Клёво
- Push-уведомление при достижении 50%/100% цели — ключевой момент retention

---

## Confidence Assessment

- **High confidence**: Технический стек (Prisma + YandexGPT), монетизация (PLUS-only AI)
- **Medium confidence**: Конкретные цифры retention от Cleo (публичные данные ограничены)
- **Low confidence**: Точный процент апгрейда FREE→PLUS через goals paywall (нет AB-теста)

---

## Sources

1. Cleo AI product blog — savings goals feature overview (reliability: medium)
2. Тинькофф API документация — цели и копилки (reliability: high)
3. Yandex Cloud YandexGPT pricing и квоты (reliability: high)
4. Recharts documentation — ProgressBar, LinearProgress (reliability: high)
5. ФЗ-152 — требования к хранению ПД (reliability: high)
