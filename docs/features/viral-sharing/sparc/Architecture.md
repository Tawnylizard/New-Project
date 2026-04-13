# Architecture: viral-sharing

## System Context

viral-sharing добавляет реферальный слой поверх существующих модулей auth и roast. Новых инфраструктурных компонентов не требует — только два новых роута и два новых компонента TMA.

```
TMA (React)                    API (Fastify)              DB (Prisma)
──────────────────────         ──────────────────         ─────────────
ShareModal                     GET /referral          →   User.referralCode
  ├─ ReferralStats               ReferralService            User.referredBy
  └─ share text builder                                      count(referredBy=code)
                                POST /auth/referral-register
RoastCard (existing)             → update User.referredBy
  └─ onShare → ShareModal

TMA init flow (existing)
  └─ parse startapp param
  └─ POST /auth/referral-register
```

## Component Breakdown

### Backend

#### `apps/api/src/routes/referral.ts` (new)
- `GET /referral` — returns stats for authenticated user
- `POST /auth/referral-register` — records referral attribution on registration

#### `apps/api/src/services/ReferralService.ts` (new)
```typescript
class ReferralService {
  getReferralStats(userId: string): Promise<ReferralStatsResponse>
  registerReferral(userId: string, referralCode: string): Promise<void>
}
```

### Frontend

#### `apps/tma/src/components/ShareModal.tsx` (new)
- Полноэкранный modal overlay
- Показывает preview-карточку + две кнопки + счётчик приглашённых
- Использует `useReferralStats` хук для данных

#### `apps/tma/src/components/ReferralStats.tsx` (new)
- Чистый UI-компонент, показывает код + счётчики
- Используется внутри ShareModal

#### `apps/tma/src/hooks/useReferralStats.ts` (new)
- React Query хук для `GET /referral`
- staleTime: 60s (данные меняются редко)

#### `apps/tma/src/hooks/useReferralRegister.ts` (new)
- Вызывается один раз при инициализации TMA если `startapp` содержит `ref_`
- POST `/auth/referral-register` с кодом из параметра

#### `RoastCard.tsx` (modify — minimal)
- `onShare` теперь открывает ShareModal вместо прямого вызова `openTelegramLink`
- Передаёт `roast` в ShareModal

#### `RoastMode.tsx` (modify — minimal)
- Добавить state: `showShareModal: boolean`
- Рендер ShareModal когда `showShareModal = true`

## Data Flow: Share

```
1. User clicks "Поделиться" on RoastCard
2. RoastMode.tsx: setShowShareModal(true)
3. ShareModal opens:
   a. useReferralStats() → GET /referral (cached 60s)
   b. Render preview card with roast excerpt + top spend
4. User clicks "Отправить другу":
   a. Build shareText from roast data + referralLink
   b. Build shareUrl: tg://msg_url?url=...&text=...
   c. window.Telegram.WebApp.openTelegramLink(shareUrl)
5. Telegram opens native share sheet
```

## Data Flow: Referral Registration

```
1. Friend receives share, clicks link
2. Telegram opens TMA with startapp=ref_<code>
3. TMA init: parse window.Telegram.WebApp.initDataUnsafe.start_param
4. If starts with "ref_": extract code, call POST /auth/referral-register
5. API: validate code, check no self-referral, set User.referredBy if null
6. Next time sharer opens ShareModal: invitedCount incremented
```

## Consistency with docs/Architecture.md

| Principle | How viral-sharing follows it |
|-----------|------------------------------|
| Thin routes | ReferralService handles all logic |
| Zod validation | Both endpoints have schemas |
| JWT auth | Both endpoints behind auth plugin |
| userId scoping | All DB queries scoped to req.user.id |
| React Query | useReferralStats uses React Query |
| No float money | Not applicable (no amounts) |
| LLM fallback | Not applicable (no LLM) |

## What is NOT changed

- Prisma schema — no migrations
- Auth flow — referral registration is a side-effect, not blocking
- RoastGenerator — not touched
- Redis — not used (referral stats are fast DB count queries)
