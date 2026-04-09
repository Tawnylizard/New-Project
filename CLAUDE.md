# CLAUDE.md — Клёво (Российский Cleo AI)

## Проект

**Клёво** — AI-финансовый ассистент для российского Gen Z (18–28 лет). Копия Cleo AI ($300M+ ARR) адаптированная для РФ-рынка.

- **Оригинал:** [meetcleo.com](https://meetcleo.com) — $500M оценка, 6M+ пользователей
- **Наш рынок:** Россия, Telegram Mini App как основной канал
- **Killer-feature:** «Жёсткий режим» — AI с характером критикует твои траты

## Ключевые документы

| Документ | Описание |
|---|---|
| [`docs/micro-trends-research.md`](docs/micro-trends-research.md) | Ресёрч 10 микро-трендов российского рынка |
| [`docs/cjm/CJM.md`](docs/cjm/CJM.md) | Customer Journey Map (3 варианта, сравнение) |
| [`docs/cjm/CJM.html`](docs/cjm/CJM.html) | HTML-версия CJM (интерактивная) |
| [`docs/ADR/`](docs/ADR/) | Architecture Decision Records |

## ADR Index

| ADR | Решение |
|---|---|
| [ADR-001](docs/ADR/ADR-001-product-name-and-positioning.md) | Название «Клёво», позиционирование |
| [ADR-002](docs/ADR/ADR-002-tech-stack.md) | Стек: Telegram TMA + YandexGPT + Yandex Cloud |
| [ADR-003](docs/ADR/ADR-003-monetization.md) | Freemium ₽199/мес, ЮKassa, МИР/СБП |
| [ADR-004](docs/ADR/ADR-004-distribution-channels.md) | Telegram-первый рост + ВК Клипы |
| [ADR-005](docs/ADR/ADR-005-data-compliance.md) | ФЗ-152, информационный сервис (без лицензии ЦБ) |
| [ADR-006](docs/ADR/ADR-006-cjm-variant.md) | CJM «Вирусный Roast» как основной путь |

## Архитектура (выбранная)

```
Frontend:  Telegram Mini App (React + Vite + TailwindCSS)
Backend:   Node.js + Fastify + TypeScript
AI/LLM:    YandexGPT API (основной) + GigaChat (резервный)
Database:  Yandex Managed PostgreSQL (ru-central1)
Cache:     Yandex Managed Redis
Auth:      Telegram initData (нативная TMA авторизация)
Payments:  ЮKassa (МИР / СБП / ЮMoney)
Hosting:   Yandex Cloud Serverless
```

## Целевые метрики MVP

| Метрика | Цель |
|---|---|
| MAU (3 мес) | 5 000 |
| Платные подписчики | 250 (5% конверсия) |
| Retention 30d | > 35% |
| Viral coefficient K | > 0.3 |
| Roast шеринг | > 15% активных |

## Команда разработки

- Основной язык: TypeScript (full-stack)
- Стиль кода: ESLint + Prettier (стандартная конфигурация)
- Коммиты: Conventional Commits
- Бранчинг: main → feature/* → PR

## Важные ограничения

1. **ФЗ-152:** Все ПД хранятся ТОЛЬКО в Yandex Cloud ru-central1
2. **Без лицензии ЦБ:** Продукт — информационный сервис, не финансовый посредник
3. **Без Visa/MC:** Оплата через МИР, СБП, ЮMoney
4. **AI дисклеймер:** Все советы сопровождаются «Это информационный сервис»
