# Pseudocode: viral-sharing

## Algorithm 1: GET /referral

```
FUNCTION getReferralStats(userId):
  user = DB.User.findUnique({ where: { id: userId } })

  referralCode = user.referralCode
  referralLink = buildReferralLink(referralCode)

  invitedCount = DB.User.count({
    where: { referredBy: referralCode }
  })

  activeCount = DB.User.count({
    where: {
      referredBy: referralCode,
      transactions: { some: {} }  // has at least 1 transaction
    }
  })

  RETURN { referralCode, referralLink, invitedCount, activeCount }

FUNCTION buildReferralLink(referralCode):
  botUsername = env.BOT_USERNAME
  RETURN "https://t.me/{botUsername}?startapp=ref_{referralCode}"
```

## Algorithm 2: POST /auth/referral-register

```
FUNCTION registerReferral(currentUserId, incomingReferralCode):
  // Validate format
  IF NOT incomingReferralCode.matches(/^[a-z0-9]{10,25}$/):
    THROW ValidationError("INVALID_REFERRAL_CODE_FORMAT")

  // Check current user already attributed
  currentUser = DB.User.findUnique({ where: { id: currentUserId } })
  IF currentUser.referredBy IS NOT NULL:
    RETURN  // idempotent — already recorded

  // Find owner of the referral code
  referrer = DB.User.findUnique({ where: { referralCode: incomingReferralCode } })
  IF referrer IS NULL:
    THROW NotFoundError("REFERRAL_CODE_NOT_FOUND")

  // Prevent self-referral
  IF referrer.id == currentUserId:
    THROW BadRequestError("SELF_REFERRAL")

  // Record attribution
  DB.User.update({
    where: { id: currentUserId },
    data: { referredBy: incomingReferralCode }
  })
```

## Algorithm 3: TMA Init — Referral Param Detection

```
FUNCTION onTMAInit():
  initDataUnsafe = window.Telegram.WebApp.initDataUnsafe
  startParam = initDataUnsafe?.start_param ?? ""

  IF startParam.startsWith("ref_"):
    referralCode = startParam.slice(4)  // remove "ref_" prefix
    CALL registerReferral(referralCode)  // fire-and-forget, don't block UI

FUNCTION registerReferral(referralCode):
  TRY:
    POST /auth/referral-register { referralCode }
    // ignore response — idempotent, errors non-critical
  CATCH:
    LOG "Referral registration failed" (non-fatal)
```

## Algorithm 4: Build Share Text

```
FUNCTION buildShareText(roast, referralLink):
  excerpt = roast.roastText.slice(0, 120)
  IF roast.roastText.length > 120:
    excerpt += "..."

  topCategory = getTopCategory(roast.spendingSummary)
  topAmount   = formatRubles(topCategory.amountKopecks)
  totalAmount = formatRubles(roast.spendingSummary.totalAmount)

  shareText = """
🔥 Клёво разнесло мои траты в пух и прах!

«{excerpt}»

Топ расход: {topCategory.name} — {topAmount}
Всего за месяц: {totalAmount}

👉 Попробуй сам: {referralLink}
  """.trim()

  RETURN shareText

FUNCTION getTopCategory(spendingSummary):
  // spendingSummary.byCategory is array of { category, amountKopecks }
  RETURN spendingSummary.byCategory.sort by amountKopecks DESC [0]

FUNCTION formatRubles(kopecks):
  RETURN "₽" + Math.round(kopecks / 100).toLocaleString("ru-RU")
```

## Algorithm 5: Share Action

```
FUNCTION onClickSendToFriend(shareText, referralLink):
  shareUrl = buildTelegramShareUrl(shareText, referralLink)
  
  TRY:
    window.Telegram.WebApp.openTelegramLink(shareUrl)
  CATCH:
    // Fallback: open in browser
    window.open(shareUrl, "_blank")

FUNCTION buildTelegramShareUrl(shareText, referralLink):
  RETURN "tg://msg_url?" +
    "url=" + encodeURIComponent(referralLink) +
    "&text=" + encodeURIComponent(shareText)

FUNCTION onClickCopyLink(referralLink):
  TRY:
    await navigator.clipboard.writeText(referralLink)
    showToast("Ссылка скопирована!")
  CATCH:
    // Clipboard API not available (some TMA versions)
    showToast("Ссылка: " + referralLink)
```

## Algorithm 6: RoastCard onShare upgrade

```
// Before (existing):
FUNCTION onShare():
  openTelegramLink(shareUrl)

// After:
FUNCTION onShare():
  setShowShareModal(true)  // parent state in RoastMode.tsx

// RoastMode.tsx renders:
IF showShareModal:
  RENDER <ShareModal
    roast={currentRoast}
    referralStats={referralStats}
    onClose={() => setShowShareModal(false)}
  />
```
