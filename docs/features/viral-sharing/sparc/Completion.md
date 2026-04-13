# Completion: viral-sharing

## Definition of Done

All items must be checked before marking this feature as complete.

### Backend
- [ ] `GET /referral` route returns `{ referralCode, referralLink, invitedCount, activeCount }`
- [ ] `POST /auth/referral-register` validates, prevents self-referral, is idempotent
- [ ] Both routes protected by JWT auth plugin
- [ ] Both routes have Zod schemas for input validation
- [ ] `ReferralService` with unit tests (≥80% coverage)
- [ ] Integration tests for both routes pass
- [ ] `BOT_USERNAME` env var added to `.env.example`

### Frontend
- [ ] `ShareModal.tsx` renders preview card with roast excerpt + top spend + referralLink
- [ ] "Отправить другу" button triggers Telegram native share via `openTelegramLink`
- [ ] "Скопировать ссылку" button uses `navigator.clipboard.writeText` with fallback
- [ ] `useReferralStats` React Query hook with 60s staleTime
- [ ] `useReferralRegister` hook fires on TMA init when `startapp=ref_<code>`
- [ ] `RoastCard.tsx` / `RoastMode.tsx` modified: `onShare` opens ShareModal
- [ ] Share text includes: excerpt (≤120 chars) + top category + total amount + referralLink

### Shared Types
- [ ] `ReferralStatsResponse` and `ReferralRegisterRequest` added to `@klyovo/shared`

### Quality
- [ ] TypeScript strict mode — no `any`, no non-null assertion without comment
- [ ] All DB queries scoped to authenticated user
- [ ] Self-referral blocked server-side
- [ ] Edge cases from Refinement.md covered in tests

### Commits
- [ ] `feat(api): add GET /referral and POST /auth/referral-register endpoints`
- [ ] `feat(tma): add ShareModal with branded share card and referral stats`
- [ ] `feat(shared): add ReferralStatsResponse and ReferralRegisterRequest types`
- [ ] `test(api): add ReferralService unit tests and referral route integration tests`

## Acceptance Criteria

1. **Тест 1:** Авторизованный пользователь делает `GET /referral` → получает свой `referralCode`, `referralLink`, `invitedCount`, `activeCount`.
2. **Тест 2:** Новый пользователь открывает TMA с `startapp=ref_<code>` → `POST /auth/referral-register` вызывается, `referredBy` устанавливается в БД.
3. **Тест 3:** Попытка самореферала → 400 `SELF_REFERRAL`.
4. **Тест 4:** Повторный вызов `POST /auth/referral-register` → 200, `referredBy` не перезаписывается.
5. **Тест 5:** После нажатия «Поделиться» на RoastCard → открывается ShareModal с превью карточки, кнопкой «Отправить другу» и кнопкой «Скопировать ссылку».
6. **Тест 6:** Нажатие «Отправить другу» → `openTelegramLink` вызван с правильным URL содержащим `ref_<code>` и текстом roast.
7. **Тест 7:** `POST /auth/referral-register` с несуществующим кодом → 404 `REFERRAL_CODE_NOT_FOUND`.
8. **Тест 8:** `POST /auth/referral-register` с невалидным форматом (спецсимволы, длина вне 10-25) → 400 Zod validation error.
9. **Тест 9:** `buildShareText` с пустым `byCategory` → строка «Топ расход» не включается в текст, остальной текст корректен.
10. **Тест 10:** `navigator.clipboard` недоступен → показывается toast с текстом ссылки вместо silent copy.
11. **Тест 11:** TMA открыт без `startapp` параметра → `POST /auth/referral-register` НЕ вызывается.
12. **Тест 12:** `startapp` не начинается с `ref_` → регистрация реферала не происходит.
