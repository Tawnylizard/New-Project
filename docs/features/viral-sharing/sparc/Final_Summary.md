# Final Summary: viral-sharing

## Feature Overview

viral-sharing превращает кнопку «Поделиться» на экране roast в полноценный вирусный механизм: брендированный текст с выдержкой из roast + реферальная ссылка + трекинг приглашённых.

## Scope

**In scope (MVP):**
- ShareModal компонент с preview-карточкой и двумя кнопками шеринга
- Telegram native share через `openTelegramLink` с форматированным текстом
- `GET /referral` — возвращает реферальный код, ссылку и счётчики
- `POST /auth/referral-register` — записывает атрибуцию при открытии TMA по реф-ссылке
- Показ `invitedCount` в ShareModal для мотивации к повторному шерингу

**Out of scope (v1.0):**
- PNG/OG-изображение для предпросмотра в Telegram (требует puppeteer/satori)
- Push-уведомления при регистрации реферала
- Монетизация рефералов (скидки, cashback)
- Leaderboard рефералов

## Files to Create/Modify

| File | Action |
|------|--------|
| `apps/api/src/routes/referral.ts` | CREATE |
| `apps/api/src/routes/referral.test.ts` | CREATE |
| `apps/api/src/services/ReferralService.ts` | CREATE |
| `apps/api/src/services/ReferralService.test.ts` | CREATE |
| `apps/tma/src/components/ShareModal.tsx` | CREATE |
| `apps/tma/src/components/ReferralStats.tsx` | CREATE |
| `apps/tma/src/hooks/useReferralStats.ts` | CREATE |
| `apps/tma/src/hooks/useReferralRegister.ts` | CREATE |
| `apps/tma/src/pages/RoastMode.tsx` | MODIFY (add ShareModal state) |
| `apps/tma/src/components/RoastCard.tsx` | MODIFY (onShare → setShowShareModal) |
| `packages/shared/src/types.ts` | MODIFY (add 2 types) |
| `.env.example` | MODIFY (add BOT_USERNAME) |

## Key Decisions

1. **Текст, не PNG** — форматированный Telegram-текст достаточен для MVP, не требует серверного рендеринга
2. **`startapp` вместо `start`** — открывает TMA напрямую, без промежуточного шага бота
3. **referredBy иммутабелен** — первый реферер побеждает, нет перезаписи
4. **Нет новых таблиц** — `referralCode` и `referredBy` уже в схеме User
5. **activeCount = users with transactions** — защита от спам-аккаунтов в статистике

## Success Metrics

| Метрика | Цель |
|---------|------|
| % roast сессий с кликом «Поделиться» | > 15% |
| Share → новый пользователь (K-factor) | > 0.3 |
| Referral stats views / MAU | > 20% |

## Dependencies

- roast-mode: DONE (RoastCard, GenerateRoastResponse существуют)
- telegram-auth: DONE (JWT auth, User схема существует)
- Нет новых внешних зависимостей
