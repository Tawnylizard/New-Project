# Specification: viral-sharing

## API Endpoints

### GET /referral

Returns referral stats for the authenticated user.

**Auth:** JWT required

**Response 200:**
```json
{
  "referralCode": "clk1234abc",
  "referralLink": "https://t.me/klyovobot?startapp=ref_clk1234abc",
  "invitedCount": 3,
  "activeCount": 2
}
```

**Logic:**
- `referralCode` = `req.user.referralCode`
- `referralLink` = `https://t.me/${BOT_USERNAME}?startapp=ref_${referralCode}`
- `invitedCount` = `count(User where referredBy = referralCode)`
- `activeCount` = `count(User where referredBy = referralCode AND transactions.count > 0)`

---

### POST /auth/referral-register

Called during registration flow when `startapp=ref_<code>` is present in TMA init params.
Stores the referral attribution.

**Auth:** JWT required (called after token issued)

**Request body:**
```json
{
  "referralCode": "clk1234abc"
}
```

**Response 200:**
```json
{ "ok": true }
```

**Validation rules:**
- `referralCode` must match `^[a-z0-9]{10,25}$`
- Target user (owner of referralCode) must exist
- `referralCode` owner must NOT be the current user (no self-referral)
- If `req.user.referredBy` is already set → ignore (idempotent, return ok)

**Zod schema:**
```typescript
const ReferralRegisterBody = z.object({
  referralCode: z.string().regex(/^[a-z0-9]{10,25}$/)
})
```

---

## Data Model (no migrations needed)

Existing `User` model fields used:

| Field | Type | Purpose |
|-------|------|---------|
| `referralCode` | `String @unique @default(cuid())` | This user's shareable code |
| `referredBy` | `String?` | referralCode of user who invited this user |

No new tables or migrations required.

---

## Frontend Components

### ShareModal

**Location:** `apps/tma/src/components/ShareModal.tsx`

**Props:**
```typescript
interface ShareModalProps {
  roast: GenerateRoastResponse
  referralCode: string
  referralLink: string
  invitedCount: number
  onClose: () => void
}
```

**Layout:**
```
┌─────────────────────────────┐
│  🔥 Поделись ростом!        │
│                             │
│  ┌───────────────────────┐  │
│  │ Preview Card (HTML)   │  │
│  │ • Top category spend  │  │
│  │ • roastText excerpt   │  │
│  │ • Клёво branding      │  │
│  └───────────────────────┘  │
│                             │
│  [📤 Отправить другу]       │
│  [🔗 Скопировать ссылку]    │
│                             │
│  👥 Приглашено: N человек   │
│  Код: clk1234abc            │
│                             │
│  [✕ Закрыть]                │
└─────────────────────────────┘
```

**Share text format:**
```
🔥 Клёво разнесло мои траты в пух и прах!

«{первые 120 символов roastText}...»

Топ расход: {topCategory} — ₽{topAmount}
Всего за месяц: ₽{totalAmount}

👉 Попробуй сам: {referralLink}
```

**Share mechanism:**
1. Primary: `window.Telegram.WebApp.openTelegramLink(shareUrl)` where `shareUrl = tg://msg_url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`
2. Fallback: `navigator.clipboard.writeText(referralLink)` + toast «Ссылка скопирована»

---

### ReferralStats (mini-section)

**Location:** `apps/tma/src/components/ReferralStats.tsx`

**Props:**
```typescript
interface ReferralStatsProps {
  referralCode: string
  referralLink: string
  invitedCount: number
  activeCount: number
}
```

**Shown in:** Bottom of ShareModal (MVP). Profile/Settings page is v1.0 scope.

---

## Shared Types

Add to `packages/shared/src/types.ts`:

```typescript
export interface ReferralStatsResponse {
  referralCode: string
  referralLink: string
  invitedCount: number
  activeCount: number
}

export interface ReferralRegisterRequest {
  referralCode: string
}
```

---

## Environment Variables Required

| Var | Purpose |
|-----|---------|
| `BOT_USERNAME` | Telegram bot username (for referralLink construction) |

Add to `.env.example`: `BOT_USERNAME=klyovobot`

---

## Error Cases

| Scenario | HTTP | Code |
|----------|------|------|
| Self-referral | 400 | `SELF_REFERRAL` |
| referralCode owner not found | 404 | `REFERRAL_CODE_NOT_FOUND` |
| Already has referredBy | 200 | — (idempotent ok) |
| Invalid referralCode format | 400 | Zod validation error |
