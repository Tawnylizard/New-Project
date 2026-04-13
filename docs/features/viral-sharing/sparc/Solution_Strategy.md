# Solution Strategy: viral-sharing

## Problem Statement (SCQA)

- **Situation:** В Клёво уже есть кнопка «Поделиться» на RoastCard, shareUrl генерируется
- **Complication:** Кнопка открывает голую ссылку без текста и визуала → низкая конверсия
- **Question:** Как превратить шеринг roast в вирусную точку роста с трекингом?
- **Answer:** Share Modal с брендированным текстом + реферальная ссылка + stats endpoint

## First Principles Analysis

1. Шеринг работает, когда получатель испытывает FOMO или любопытство
2. Текст roast сам по себе — сильный крючок («посмотри, как AI меня разнёс»)
3. Реферальный код нужно встроить в share URL, чтобы конверсия была traceable
4. В Telegram форматированный текст с emoji выглядит лучше голой ссылки
5. Referral stats нужны чтобы пользователь возвращался в приложение

## Recommended Approach

### 1. ShareModal компонент (TMA)
```
Share button → ShareModal opens →
  [Branded card preview: emoji + top spend + quote]
  [Button: "Отправить другу" → openTelegramLink with text]
  [Button: "Скопировать ссылку" → clipboard]
  [Show: referralCode + "Приглашено: N человек"]
```

### 2. Share Text Format (Telegram)
```
🔥 Клёво разнесло мои траты в пух и прах!

«{первые 100 символов roastText}...»

Топ расход: {category} — ₽{amount}
Всего за месяц: ₽{total}

👉 Попробуй сам: https://t.me/{bot}?startapp=ref_{referralCode}
```

### 3. GET /referral endpoint
```
GET /referral
→ { referralCode, referralLink, invitedCount, activeCount }

где:
  referralLink = https://t.me/{bot}?startapp=ref_{referralCode}
  invitedCount = count(users where referredBy = myReferralCode)
  activeCount  = count(users where referredBy = myReferralCode AND имели хотя бы 1 транзакцию)
```

### Key Design Decisions

**1. Текст, не изображение (MVP)**
- Генерация PNG требует puppeteer/satori на сервере — дорого для MVP
- Форматированный Telegram-текст конвертирует достаточно хорошо
- Можно добавить OG-изображения в v1.0

**2. referralCode в startapp, не в start**
- `startapp=ref_<code>` → открывает TMA с параметром → JS обрабатывает немедленно
- `start=ref_<code>` → бот должен явно обработать команду → лишний шаг

**3. Нет новых DB-сущностей**
- `User.referredBy` и `User.referralCode` уже есть → просто делаем count query
- Экономия на migration и complexity

## TRIZ Contradictions Resolved

| Противоречие | Принцип | Решение |
|---|---|---|
| Яркий шеринг vs. нет сервера для PNG | #25 Самообслуживание | Telegram нативное форматирование |
| Трекинг vs. без новых сущностей | #10 Предварительное действие | Используем уже существующие поля |

## Risk Assessment

| Риск | Вероятность | Митигация |
|---|---|---|
| Telegram `shareUrl()` не поддерживается старыми клиентами | Средняя | Fallback на `openTelegramLink` |
| Пользователи не читают refer stats | Средняя | Показывать прямо в Share Modal |
| Clipborad API не работает в TMA | Низкая | Fallback: alert с текстом |
