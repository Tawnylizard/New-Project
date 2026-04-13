# Refinement: viral-sharing — Edge Cases & Testing

## Edge Cases

### Referral Registration

| Case | Expected Behaviour |
|------|-------------------|
| User opens app without `startapp` param | No referral call made |
| `startapp` doesn't start with `ref_` | Ignore (could be other deep-link type) |
| referralCode format invalid (too short/long/wrong chars) | 400, no DB write |
| referralCode owner not found (deleted account) | 404, non-fatal on TMA side |
| Self-referral (user shares to themselves) | 400 `SELF_REFERRAL`, ignored by TMA |
| `referredBy` already set (repeat registration) | 200 idempotent, no overwrite |
| Concurrent registration calls (double-tap) | Prisma `update` is atomic; second call hits "already set" guard |

### Share Text Generation

| Case | Expected Behaviour |
|------|-------------------|
| roastText < 120 chars | No ellipsis appended |
| roastText exactly 120 chars | No ellipsis appended |
| roastText > 120 chars | Truncate at 120 + "..." |
| spendingSummary.byCategory is empty | Skip "Топ расход" line |
| totalAmount = 0 | Show "₽0" |
| referralLink URL has special chars | `encodeURIComponent` handles it |

### Clipboard API

| Case | Expected Behaviour |
|------|-------------------|
| `navigator.clipboard` available | Write link silently, show toast |
| `navigator.clipboard` unavailable | Catch, show toast with full link as text |
| User denies clipboard permission | Catch, show toast with full link |

### Telegram Share URL

| Case | Expected Behaviour |
|------|-------------------|
| `openTelegramLink` throws | Try `window.open` fallback |
| Both fail | Log error, modal stays open with copy button |

### Referral Stats

| Case | Expected Behaviour |
|------|-------------------|
| User has 0 invited | `invitedCount: 0`, `activeCount: 0` |
| Large invited count (N > 1000) | Count query returns number correctly |
| `GET /referral` called before user has transactions | Works — invitedCount is for their invitees |
| staleTime 60s → data shows count-1 briefly | Acceptable UX for MVP |

---

## Security Considerations

| Threat | Mitigation |
|--------|-----------|
| Self-referral farming | `referrer.id == currentUserId` check |
| Forged referralCode (guessing) | cuid() has sufficient entropy (~131 bits) |
| Referral overwrite (second attribution) | `referredBy` immutable once set |
| Mass invitedCount inflation (fake accounts) | `activeCount` filters for users with transactions |
| referralLink injection in shareText | `encodeURIComponent` on all dynamic values |

---

## Test Scenarios

### Unit Tests: ReferralService

```
describe('getReferralStats')
  ✅ returns correct referralCode and link for user
  ✅ returns invitedCount = 0 when no users were referred
  ✅ returns invitedCount = N matching users with referredBy = code
  ✅ activeCount only counts users with at least 1 transaction

describe('registerReferral')
  ✅ sets referredBy when valid code and not self
  ✅ is idempotent: second call with same code returns ok
  ✅ throws SELF_REFERRAL when referrer.id === currentUserId
  ✅ throws REFERRAL_CODE_NOT_FOUND when code doesn't exist
  ✅ rejects invalid format (too short, uppercase, special chars)
  ✅ does NOT overwrite existing referredBy (first referrer wins)
```

### Integration Tests: /referral route

```
GET /referral
  ✅ 401 without JWT
  ✅ 200 with correct shape { referralCode, referralLink, invitedCount, activeCount }
  ✅ referralLink contains BOT_USERNAME env var

POST /auth/referral-register
  ✅ 401 without JWT
  ✅ 200 with valid code
  ✅ 400 SELF_REFERRAL
  ✅ 404 REFERRAL_CODE_NOT_FOUND
  ✅ 200 idempotent on repeat call
  ✅ 400 invalid format
```

### Frontend Tests

```
ShareModal
  ✅ renders share text preview with roast excerpt
  ✅ shows invitedCount from props
  ✅ "Отправить другу" calls openTelegramLink with correct URL
  ✅ "Скопировать ссылку" calls clipboard.writeText
  ✅ shows toast on clipboard success
  ✅ shows fallback text on clipboard failure
  ✅ onClose prop fires on close button

useReferralRegister hook
  ✅ fires POST if startParam starts with "ref_"
  ✅ does NOT fire if startParam is empty
  ✅ does NOT fire if startParam doesn't start with "ref_"
  ✅ non-fatal on 4xx/5xx response
```

---

## Performance

- `GET /referral`: two `count()` queries on indexed `referredBy` column. Expected < 10ms at MVP scale.
- No Redis caching needed for MVP (data freshness > performance at 5K MAU).
- React Query staleTime: 60s to avoid hammering on rapid re-renders.
