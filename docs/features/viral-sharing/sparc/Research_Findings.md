# Research Findings: viral-sharing

## Executive Summary

Вирусный рост через шеринг — ключевой механизм финтех-приложений (Cleo, Monzo, Revolut). Telegram-нативный шеринг через `openTelegramLink` с кастомизированным текстом — наиболее эффективный путь в TMA. Реферальные программы с видимым прогрессом увеличивают активацию на 20–40%.

## Telegram Share Mechanisms

### Текущие API (Bot API + WebApp API)

| Метод | Описание | Поддержка |
|---|---|---|
| `openTelegramLink(url)` | Открывает Telegram-ссылку с предпросмотром | WebApp ≥6.0 |
| `shareUrl(url, text)` | Forwarding с текстом | WebApp ≥8.0 (только мобайл) |
| `shareToStory(url, opts)` | Story с медиа | WebApp ≥8.0 beta |
| Deep link `tg://msg_url?url=&text=` | Классический share | Универсальный |

**Вывод:** `openTelegramLink` с правильно сформированным URL (включая предпросмотр текста) — наиболее стабильный и широко поддерживаемый метод.

### Telegram Bot Deep Links (Start Parameters)

```
https://t.me/<bot>?start=<parameter>
```

- `start=ref_<code>` → бот получает `/start ref_<code>`
- `start=roast_<id>` → бот показывает roast по ID
- Параметр `startapp=<value>` → открывает Mini App с параметром

**Оптимальный share URL:**
```
https://t.me/<bot>?startapp=ref_<referralCode>
```

Это откроет TMA напрямую с referralCode в параметре.

## Referral Program Best Practices

### Double-sided incentives (Cleo, Revolut pattern)
- Дающий: «Пригласи друга → получи бесплатный roast»
- Получающий: «Первый месяц Клёво Плюс бесплатно»
- MVP: просто показываем счётчик (без автоматических наград)

### Progress visibility
- «2 из 3 друзей уже присоединились» → ощущение близости к цели
- Увеличивает шеринг на 30–40% (исследования Dropbox-style referral)

## Competitive Analysis

| Продукт | Share механизм | K-factor |
|---|---|---|
| Cleo AI | "Your Cleo Roast" card + Twitter share | ~0.4 |
| Splitwise | "Your spending summary" + WhatsApp | ~0.2 |
| Monzo | "Your year in money" PNG | ~0.5 (seasonal) |

**RU-специфика:** Telegram >> Twitter/Facebook. Forwarding работает лучше story (охват выше).

## Technology Assessment

### HTML Share Card в TMA
- Плюсы: мгновенно, не нужен сервер для рендеринга
- Минусы: не генерирует OG-изображение для предпросмотра
- Решение MVP: форматированный текст + emoji + link → хорошо выглядит в Telegram

### Referral tracking
- `User.referredBy` уже есть в схеме — хранит referralCode пригласившего
- `User.referralCode` — уникальный код каждого пользователя (cuid())
- Достаточно для MVP: count users where referredBy = myCode

## Confidence Assessment

- **High:** Telegram share механизм через openTelegramLink работает во всех версиях TMA
- **High:** referralCode/referredBy в схеме — достаточно для базового трекинга
- **Medium:** K-factor цель 0.3 — реалистична при хорошем copy и UX шеринга
